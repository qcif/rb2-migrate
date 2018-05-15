//
// Typescript version of Stash 2 -> 3 migration code
//

// questions about this:

// 

import axios from 'axios';

const config = require( 'config' );

import { ReDBox } from './redbox';





async function main(): Promise<void> {
    const baseURL = config.get('Redbox.url');
    const apiKey = config.get('Redbox.apiKey');
    const rb = new ReDBox(baseURL, apiKey);
    const results = await rb.search('dmpt');
    console.log("Got " + results.length + " objects");
    for( var i in results ) {
	let md = await rb.recordmeta(results[i]);
	console.log(results[i], md["dc:title"]);
    }
}



main();



