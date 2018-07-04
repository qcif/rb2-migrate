//
// Typescript version of Stash 2 -> 3 migration code
//

import axios from 'axios';
import { Redbox, Redbox1, Redbox2 } from './redbox';
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
      if( outdir ) {
        await fs.writeJson(
          path.join(outdir, util.format("%s_orig.json", oid)),
          md, { spaces: 4 }
        );
        await fs.writeJson(
          path.join(outdir, util.format("%s_unflat.json", oid)),
          mdu, { spaces: 4 }
        );
        await fs.writeJson(
          path.join(outdir, util.format("%s_new.json", oid)),
          md2, { spaces: 4 }
        );
      }
      if( rbDest ) {
        if( checkdots(md2) ) {
          try { 
            const noid = await rbDest.createRecord(md2, dest_type);
            report.push([oid, "create", "", "", "", noid]);
          } catch(e) {
            report.push([oid, "create", "", "", "create failed", e]);
          }
        } else {
          report.push([oid, "failed", "", "", "bad json", ""]);
        }
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

