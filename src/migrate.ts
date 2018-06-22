//
// Typescript version of Stash 2 -> 3 migration code
//

import axios from 'axios';
import { Redbox, Redbox1, Redbox2 } from './redbox';
import { crosswalk } from './crosswalk';
import { ArgumentParser } from 'argparse';
const fs = require('fs-extra');
const config = require('config');
const util = require('util');
const path = require('path');
const winston = require('winston');
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
  const packagetype = options['type'];
  const outdir = options['outdir'];

  const cw = await loadcrosswalk(packagetype);
  if( ! cw ) {
    return;
  }

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
    var spinner = new Spinner("Listing records: " + packagetype);
    spinner.setSpinnerString(17);
    spinner.start();
    rbSource.setProgress(s => spinner.setSpinnerTitle(s));
    const results = await rbSource.list(packagetype);
    let n = results.length;
    for( var i in results ) {
      let md = await rbSource.getRecord(results[i]);
      // let ds = await rbSource.listDatastreams(results[i]);
      // spinner.setSpinnerTitle(util.format("Migrating %d/%d %s", i, n, packagetype));
      spinner.setSpinnerTitle(util.format("Crosswalking %d", i));
      const md2 = crosswalk(log, cw, md);
      if( outdir ) {
        await fs.writeJson(
          path.join(outdir, util.format("old_%d.json", i)),
          md
        );
        await fs.writeJson(
          path.join(outdir, util.format("new_%d.json", i)),
          md2
        );
      }
      if( rbDest ) {
        // add record;
      }
    }
    spinner.setSpinnerTitle("Done.");
    spinner.stop();
    console.log("\n");
  } catch (e) {
    log.error("Migration error:" + e);
  }
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



var args = parser.parseArgs();

if( 'type' in args && args['type'] ){  
  migrate(args);
} else {
  info(args['source']);
}

