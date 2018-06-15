//
// Typescript version of Stash 2 -> 3 migration code
//

import axios from 'axios';
import { Redbox, Redbox1 } from './redbox';
import { ArgumentParser } from 'argparse';
const fs = require('fs-extra');
const config = require('config');
const util = require('util');
import { Spinner } from 'cli-spinner';


function connect(server: string): Redbox1 {
  const cf = config.get('servers.' + server);
  return new Redbox1(cf);
}


async function migrate(source: string, dest: string, packagetype:string, outfile?:string): Promise<void> {
  try {
    console.log("About to connect");
    const rbSource = connect(source);
    console.log("Got rbsource = " + rbSource);
    //const rbDest = connect(dest);
    var spinner = new Spinner("Listing records: " + packagetype);
    spinner.setSpinnerString(17);
    console.log("Starting spinner??");
    spinner.start();
    
    rbSource.setProgress(s => spinner.setSpinnerTitle(s));
    const results = await rbSource.list(packagetype);
    let n = results.length;
    for( var i in results ) {
      let md = await rbSource.getRecordMetadata(results[i]);
      let ds = await rbSource.listDatastreams(results[i]);
      spinner.setSpinnerTitle(util.format("Migrating %d/%d %s", i, n, packagetype));
      if( outfile ) {
        await fs.appendFile(outfile, util.format("oid %s\n", results[i]));
        if( ds ) {
          for( var j in ds ) {
            await fs.appendFile(outfile, util.format("    datastream %s\n", ds[j]));
          }
        }
      }
      //let resp = await rbDest.createObject(md);
      //console.log(resp);
      //process.exit(-1);
    }
    spinner.stop();
    console.log("\n");
  } catch (e) {
    console.log("Connection to ReDBox failed %s", e)
  }
}


async function info(source: string) {
  console.log("Source");
  const rbSource = connect(source);
  const r = await rbSource.info();
  console.log(r);
}

var parser = new ArgumentParser({
  version: '0.0.1',
  addHelp: true,
  description: "ReDBox 1.x -> 2.0 migration script"
});

parser.addArgument(
  [ '-t', '--type'],
  {
    help: "package type: omit for list of types",
    defaultValue: ""
  }
);

parser.addArgument(
  [ '-s', '--source'],
  {
    help: "source - must match a server in config",
    defaultValue: "Source"
  }
);

parser.addArgument(
  [ '-d', '--dest' ],
  {
    help: "destination - must match a server in config",
    defaultValue: "Dest"
  }
);

parser.addArgument(
  [ '-o', '--output' ],
  {
    help: "filename for dumping out a list of migrated records",
    defaultValue: null
  }
);



var args = parser.parseArgs();

if( 'type' in args && args['type'] ){
  console.log("Type = " + args['type']);
  migrate(args['source'], args['dest'], args['type'], args['output']);
} else {
  console.log("Going for info");
  info(args['source']);
}

