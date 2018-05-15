
// A class which connects to a ReDBox instance via its API
// Uses the axios module to do the https connection

import axios from 'axios';

import { AxiosInstance } from 'axios';

/**
    Class for working with the ReDBox API

*/

export class ReDBox {

    baseURL: string;
    apiKey: string;
    ai: AxiosInstance;
    
    constructor(baseURL: string, apiKey: string) {
	this.baseURL = baseURL;
	this.apiKey = apiKey;
	this.ai = axios.create({
	    baseURL: this.baseURL,
	    headers: {
		"Authorization": "Bearer " + this.apiKey,
		"Content-Type": "application/json"
	    }
	});
    }

    async apiget(path: string, params: Object): Promise<Object|undefined> {
	let url = path;
	if( url[0] !== '/' ) {
	    url = '/' + url;
	}
	try {
	    let response = await this.ai.get(url, { params: params });
	    if( response.status === 200 ) {
		return response.data;
	    }
	} catch ( e ) {
	    return undefined;
	}
    }

    /* search returns a list of all the items in the
       ReDBox of the specified type */
 
    async search(ptype: string, start?:number): Promise<Object[]> {
	let list: Object[] = [];
	let q = 'packageType:' + ptype;
	let i = 0;

	try { 
	    let qp = q + ';start=' + String(i);
	    var resp = await this.apiget('search', { q: qp });
	    //console.log(resp);
	    list.push(resp);
	} catch(e) {
	    console.log("Error " + e);
	}
	return list;
    }
}



