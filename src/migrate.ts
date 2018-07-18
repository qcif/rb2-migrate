//
// Typescript version of Stash 2 -> 3 migration code
//

import { Redbox, Redbox1, Redbox2 } from './Redbox';
import { crosswalk, checkdots } from './crosswalk';
import { ArgumentParser } from 'argparse';

const fs = require('fs-extra');
const config = require('config');
const util = require('util');
const path = require('path');
const winston = require('winston');
const stringify = require('csv-stringify/lib/sync');
import { Spinner } from 'cli-spinner';


function getlogger() {
  const logcfs = config.get('logs');
  return winston.createLogger({
    level: 'error',
    format: winston.format.simple(),
    transports: logcfs.map((cf) => {
      if( 'filename' in cf ) {
        return new winston.transports.File(cf);
      } else {
        return new winston.transports.Console();
      }
    })
  });
}


function connect(server: string): Redbox {
  if( server ) {
    const cf = config.get('servers.' + server);
    if( cf['version'] === 'Redbox1' ) {
      return new Redbox1(cf);
    } else {
      return new Redbox2(cf);
    }
  }
}





async function loadcrosswalk(packagetype: string): Promise<Object|undefined> {
  const cwf = path.join(config.get("crosswalks"), packagetype + '.json');
  try {
    log.info("Loading crosswalk " + cwf);
    const cw = await fs.readJson(cwf);
    return cw
  } catch(e) {
    log.error("Error loading crosswalk " + cwf + ": " + e);
    return null;
  }
}




async function migrate(options: Object): Promise<void> {
  const source = options['source'];
  const dest = options['dest'];
  const source_type = options['type'];
  const outdir = options['outdir'];
  const limit = options['number'];

  const cw = await loadcrosswalk(source_type);
  if( ! cw ) {
    return;
  }

  if( source_type !== cw['source_type'] ) {
    log.error("Source type mismatch: " + source_type + '/' + cw['source_type']);
    return;
  }

  const dest_type = cw['dest_type'];

  var rbSource, rbDest;
  
  try {
    rbSource = connect(source);
  } catch(e) {
    log.error("Error connecting to source rb " + source + ": " + e);
    return;
  }

  try {
    rbDest = connect(dest);
  } catch(e) {
    log.error("Error connecting to dest rb " + dest + ": " + e);
    return;
  }

  if( outdir ) {
    await(fs.ensureDir(path.join(outdir, 'originals')));
    await(fs.ensureDir(path.join(outdir, 'new')));
  }

  try {
    var spinner = new Spinner("Listing records: " + source_type);
    spinner.setSpinnerString(17);
    spinner.start();
    rbSource.setProgress(s => spinner.setSpinnerTitle(s));
    var results = await rbSource.list(source_type);
    if( limit && parseInt(limit) > 0 ) {
      results = results.splice(0, limit);
    }
    let n = results.length;
    var report = [ [ 'oid', 'stage', 'ofield', 'nfield', 'status', 'value' ] ];
    for( var i in results ) {
      let md = await rbSource.getRecord(results[i]);
      spinner.setSpinnerTitle(util.format("Crosswalking %d of %d", Number(i) + 1, results.length));
      const oid = md[cw['idfield']];
      const [ mdu, md2 ] = crosswalk(cw, md, ( stage, ofield, nfield, msg, value ) => {
        report.push([oid, stage, ofield, nfield, msg, value]);
      });
      var noid = 'new_' + oid;
      if( rbDest ) {
        if( checkdots(md2) ) {
          try { 
            noid = await rbDest.createRecord(md2, dest_type);
            if( noid ) {
              report.push([oid, "create", "", "", "", noid]);
            } else {
              report.push([oid, "create", "", "", "null noid", ""]);
            }
          } catch(e) {
            report.push([oid, "create", "", "", "create failed", e]);
          }
        } else {
          report.push([oid, "failed", "", "", "bad json", ""]);
        }
        if( noid && noid !== 'new_' + oid ) {
          const perms = await setpermissions(rbSource, rbDest, oid, noid, md2, cw['permissions']);
          if( 'error' in perms ) {
            report.push([oid, "permissions", "", "", "permissions failed", perms['error'] ]);
          } else {
            report.push([oid, "permissions", "", "", "set", perms]);
          }
        }
      }

      if( outdir ) {
        dumpjson(outdir, oid, noid, md, mdu, md2);
      }
    }

    spinner.setSpinnerTitle("Done.");
    spinner.stop();
    console.log("\n");
    await writereport(outdir, report);
  } catch (e) {
    log.error("Migration error:" + e);
    var stack = e.stack;
    log.error(stack);
  }
  
}


// set the permissions on a newly created record based on the crosswalk config
// and the new user lists.

async function setpermissions(rbSource: Redbox, rbDest: Redbox, noid: string, oid: string, md2: Object, pcw: Object): Promise<Object> {
  const users = await usermap(rbSource, oid, md2, pcw);
  var perms = { 'edit': [], 'view':[] };
  for ( const cat in users ) {
    for( const user in users[cat] ) {
      for( const p in pcw[cat] ) {
        if( !( user in perms[p]) ) {
          perms[p].push(user);
        }
      }  
    }
  }
  try {
    await rbDest.grantPermission(noid, 'view', perms['view']);
    return await rbDest.grantPermission(noid, 'edit', perms['edit']);
  } catch (e) {
    return { 'error': e };
  }
}


// build a dict of user categories (ie contributor_ci) to lists of user IDs

async function usermap(rbSource: Redbox, oid: string, md2: Object, pcw: Object): Promise<{ [ cat: string ]: [ string ]}> {
  var users = {};
  
  const id_field = pcw['user_id'];

  for( var c in pcw['permissions'] ) {
    if( c === '_owner' ) {
      const oldperms = await rbSource.getPermissions(oid);
      users[c] = [ oldperms['edit'][0] ];
    } else if( c in md2 ) {
      if( Array.isArray(md2[c]) ) {
        users[c] = md2[c].map((u) => u[id_field])
      } else {
        users[c] = [ md2[c][id_field] ];
      }
    }
  }
  return users;
}

 



async function dumpjson(outdir: string, oid: string, noid: string, md: Object, mdu: Object, md2: Object): Promise<void> {
  await fs.writeJson(
    path.join(outdir, 'originals', util.format("%s.json", oid)),
    md,
    { spaces: 4 }
    );
  await fs.writeJson(
    path.join(outdir, 'originals', util.format("%s_unflat.json", oid)),
    mdu,
    { spaces: 4 }
    );
  if( !noid ) {
    noid = '_' + oid;
  }
  await fs.writeJson(
    path.join(outdir, 'new', util.format("%s.json", noid)),
    md2,
    { spaces: 4 }
  );
}



async function writereport(outdir: string, report: Object):Promise<void> {
  const csvfn = path.join(outdir, "report.csv");
  const csvstr = stringify(report);
  await fs.outputFile(csvfn, csvstr);
}


async function info(source: string) {
  console.log("Source");
  const rbSource = connect(source);
  const r = await rbSource.info();
  console.log(r);
}

const log = getlogger();
    
var parser = new ArgumentParser({
  version: '0.0.1',
  addHelp: true,
  description: "ReDBox 1.x -> 2.0 migration script"
});


parser.addArgument(
  [ '-t', '--type'],
  {
    help: "Record type to migrate. Leave out for a list of types.",
    defaultValue: null
  }
);

parser.addArgument(
  [ '-s', '--source'],
  {
    help: "ReDBox server to migrate records from.",
    defaultValue: "Test1_9"
  }
);

parser.addArgument(
  [ '-d', '--dest' ],
  {
    help: "ReDBox server to migrate records to. Leave out to run in test mode.",
    defaultValue: null
  }
);


parser.addArgument(
  [ '-o', '--outdir' ],
  {
    help: "Write diagnostics and logs to this directory.",
    defaultValue: null
  }
);

parser.addArgument(
  [ '-n', '--number'],
  {
    help: "Limit migration to first n records",
    defaultValue: null
  }
);



var args = parser.parseArgs();

if( 'type' in args && args['type'] ){  
  migrate(args);
} else {
  info(args['source']);
}

