//
// Typescript version of Stash 2 -> 3 migration code
//

import axios from 'axios';
import { Redbox } from './redbox';
import { ArgumentParser } from 'argparse';
const fs = require('fs-extra');
const config = require('config');
const util = require('util');
import { Spinner } from 'cli-spinner';


function connect(server: string): Redbox {
  const baseURL = config.get('servers.' + server + '.url');
  const apiKey = config.get('servers.' + server + '.apiKey');
  return new Redbox(baseURL, apiKey);
}


async function migrate(source: string, dest: string, packagetype:string, outfile?:string): Promise<void> {
  var spinner = new Spinner("Searching for " + packagetype);
  spinner.setSpinnerString(17);
  spinner.start();
  const rbSource = connect(source);
  //const rbDest = connect(dest);
  rbSource.setprogress(s => spinner.setSpinnerTitle(s));
  const results = await rbSource.search(packagetype);
  let n = results.length;
  for( var i in results ) {
    let md = await rbSource.getObjectMeta(results[i]);
    let ds = await rbSource.listObjectDatastreams(results[i]);
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
}

async function info(source: string) {
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

if( 'type' in args ){
  migrate(args['source'], args['dest'], args['type'], args['output']);
} else {
  info(args['source']);
}

