
// A class which connects to a ReDBox instance via its API
// Uses the axios module to do the https connection


import axios from 'axios';
import { AxiosInstance } from 'axios';
const qs = require('qs');
const util = require('util');

/**
    Class for working with the ReDBox API

*/



export class Redbox {

    baseURL: string;
    apiKey: string;
    ai: AxiosInstance;
    progress: ((message: string) => void)|undefined;
    
    /* using a custom serialiser because axios' default 
       URL-encodes the solr query string for search */
    
    constructor(baseURL: string, apiKey: string) {
	this.baseURL = baseURL;
	this.apiKey = apiKey;
	this.ai = axios.create({
	    baseURL: this.baseURL,
	    headers: {
		"Authorization": "Bearer " + this.apiKey,
		"Content-Type": "application/json"
	    },
	    paramsSerializer: function(params) {
		return qs.stringify(params, { encode: false });
	    }
	});
	this.progress = undefined;
    }

    // set a progress hook which will get called with messages
    // by "long" operations like search - this is used for the
    // cli-spinner in migrate.ts
    
    setprogress(pf: (message: string) => void): void {
	this.progress = pf;
    }

    removeprogress():void {
	this.progress = undefined;
    }

    /* low-level method which is used by all the GET requests */
    
    async apiget(path: string, params?: Object): Promise<Object|undefined> {
	let url = path;
	if( url[0] !== '/' ) {
	    url = '/' + url;
	}
	try {
	    let config = {};
	    if( params ) {
		config["params"] = params;
	    }
	    let response = await this.ai.get(url, config);
	    if( response.status === 200 ) {
		return response.data;
	    }
	} catch ( e ) {
	    return undefined;
	}
    }

    /* low-level method used by POST requests */
    
    async apipost(path: string, payload: Object, params?: Object): Promise<Object|undefined> {
	let url = path;
	if( url[0] !== '/' ) {
	    url = '/' + url;
	}
	try {
	    let config = {};
	    if( params ) {
		config["params"] = params;
	    }
	    let response = await this.ai.post(url, payload, config);
	    if( response.status === 200 ) {
		return response.data;
	    }
	} catch ( e ) {
	    console.log("Post error " + String(e));
	    return undefined;
	}
    }
    
    async info(): Promise<Object> {
	try {
	    let resp = await this.apiget('/info');
	    return resp;
	} catch(e) {
	    console.log(e);
	    return {};
	}
    }

    /* search returns a list of all the items in the
       Redbox of the specified type */
 
    async search(ptype: string, start?:number): Promise<string[]> {
	let q = 'packageType:' + ptype;

	if( start === undefined ) {
	    start = 0;
	}

	try {
	    if( this.progress ) {
		this.progress(util.format("Searching for %s: %d", ptype, start));
	    }
	    let params = { q: q, start: start };
	    let resp = await this.apiget('search', params);
	    let response = resp["response"];
	    let numFound = response["numFound"];
	    let docs = response["docs"];
	    let ndocs = docs.length
	    let list = docs.map(d => d.id);
	    if( start + ndocs < numFound ) {
		let rest = await this.search(ptype, start + ndocs);
		return list.concat(rest);
	    } else {
		return list;
	    }
	} catch(e) {
	    console.log("Error " + e);
	    return [];
	}
    }

    /* Returns the metadata for object oid, or undefined if it's not
       found */
    
    async recordmeta(oid: string): Promise<Object|undefined> {
	try {
	    let response = await this.apiget('recordmetadata/' + oid);
	    return response;
	} catch(e) {
	    console.log("Error " + e);
	    return undefined;
	}
    }
   
    /* createrecord - add an object via the api.

       @metadata -> object containing the metadata
       @options -> object with the following options
            oid -> to specify the oid
            packageType -> to specify the packagetype
            skipReindex -> skip the reindex process

    **/
    
    async createrecord(metadata: Object, packagetype: string, options?: Object): Promise<string|undefined> {
	let url = '/object/' + packagetype;
	let params: Object = {};
	let resp = await this.apipost(url, metadata, options);
	if( resp && 'oid' in resp ) {
	    return resp['oid'];
	} else {
	    return undefined;
	}
    }
}



