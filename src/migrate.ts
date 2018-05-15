//
// Typescript version of Stash 2 -> 3 migration code
//

import axios from 'axios';
import { ReDBox } from './redbox';
import { ArgumentParser } from 'argparse';
const config = require('config');
const util = require('util');
import { Spinner } from 'cli-spinner';



async function main(packagetype?:string): Promise<void> {
    const baseURL = config.get('Source.url');
    const apiKey = config.get('Source.apiKey');
    const rb = new ReDBox(baseURL, apiKey);
    if( packagetype ) {
	var spinner = new Spinner("Searching for " + packagetype);
	spinner.setSpinnerString(17);
	spinner.start();
	rb.setprogress(s => spinner.setSpinnerTitle(s));
	const results = await rb.search(packagetype);
	let n = results.length;
	for( var i in results ) {
	    let md = await rb.recordmeta(results[i]);
	    spinner.setSpinnerTitle(util.format("Migrating %d/%d %s", i, n, packagetype));
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

var args = parser.parseArgs();

if( 'type' in args ){
    main(args['type']);
} else {
    main();
}

