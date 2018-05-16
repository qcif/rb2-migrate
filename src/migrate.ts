//
// Typescript version of Stash 2 -> 3 migration code
//

import axios from 'axios';
import { Redbox } from './redbox';
import { ArgumentParser } from 'argparse';
const config = require('config');
const util = require('util');
import { Spinner } from 'cli-spinner';


function connect(server: string): Redbox {
    const baseURL = config.get('servers.' + server + '.url');
    const apiKey = config.get('servers.' + server + '.apiKey');
    return new Redbox(baseURL, apiKey);
}


async function main(source: string, dest: string, packagetype?:string): Promise<void> {
    if( packagetype ) {
	var spinner = new Spinner("Searching for " + packagetype);
	spinner.setSpinnerString(17);
	spinner.start();
	rbSource = connect(source);
	rbDest = connect(dest);
	rbSource.setprogress(s => spinner.setSpinnerTitle(s));
	const results = await rbSource.search(packagetype);
	let n = results.length;
	for( var i in results ) {
	    let md = await rbSource.recordmeta(results[i]);
	    spinner.setSpinnerTitle(util.format("Migrating %d/%d %s", i, n, packagetype));
	    let resp = await rbDest.createrecord(md);
	    console.log(resp);
	    process.exit(-1);
	}
	spinner.stop();
	console.log("\n");
    } else {
	const r = await rb.info();
	console.log(r);
    }
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
	help: "source server - must match a value in config",
	defaultValue: "Source"
    }
);

parser.addArgument(
    [ '-d', '--dest' ],
    {
	help: "destination server - must match a value in config",
	defaultValue: "Dest"
    }
);
    


var args = parser.parseArgs();

if( 'type' in args ){
    main(args['source'], args['dest'], args['type']);
} else {
    main(args['source']);
}

