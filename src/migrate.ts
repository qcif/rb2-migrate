//
// Typescript version of Stash 2 -> 3 migration code
//

import axios from 'axios';
import { ReDBox } from './redbox';
import { ArgumentParser } from 'argparse';
const config = require('config');




async function main(packagetype?:string): Promise<void> {
    const baseURL = config.get('Source.url');
    const apiKey = config.get('Source.apiKey');
    const rb = new ReDBox(baseURL, apiKey);
    if( packagetype ) {
	console.log("Searching for " + packagetype);
	const results = await rb.search(packagetype);
	console.log("Got " + results.length + " objects");
	for( var i in results ) {
	    let md = await rb.recordmeta(results[i]);
	    console.log(results[i], md["dc:title"]);
	}
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

