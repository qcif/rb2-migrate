
// A class which connects to a ReDBox instance via its API
// Uses the axios module to do the https connection


import axios from 'axios';
import { AxiosInstance } from 'axios';
const qs = require('qs');
const util = require('util');

/**
    Class for working with the ReDBox APIs
*/


/* common interface for RB 1.x and 2.0 */

export interface Redbox {

  baseURL: string;
  apiKey: string;
  version: string;

  progress: ((message: string) => void)|undefined;

  setProgress(pf: (message: string) => void): void;

  info(): Promise<Object>;
  list(oid: string, start?:number ): Promise<string[]>;
  createRecord(metadata: Object, packagetype: string, options?: Object): Promise<string|undefined>;
  getRecord(oid: string): Promise<Object|undefined>;
  getRecordMetadata(oid: string): Promise<Object|undefined>;
  updateRecordMetadata(oid: string, metadata: Object): Promise<Object|undefined>;
}


/* base class with the axios http methods and progress indicator */

abstract class BaseRedbox {

  baseURL: string;
  apiKey: string;
  version: string;
  
  ai: AxiosInstance;
  progress: ((message: string) => void)|undefined;
  
  /* using a custom serialiser because axios' default 
     URL-encodes the solr query string for search */
  
  constructor(cf: Object) {
    this.baseURL = cf['baseURL'];
    this.apiKey = cf['apiKey'];
    this.progress = undefined;
  }

  /* this is separate so Redbox2 can hack baseURL */
  
  initApiClient() {
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
  }
  
  // set a progress hook which will get called with messages
  // by "long" operations like list - this is used for the
  // cli-spinner in migrate.ts
  
  setProgress(pf: (message: string) => void): void {
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
    let config = {};
    if( url[0] !== '/' ) {
      url = '/' + url;
    }
    try {
      if( params ) {
        config["params"] = params;
      }
      let response = await this.ai.post(url, payload, config);
      if( response.status >= 200 && response.status < 300 ) {
        return response.data;
      }
    } catch ( e ) {
      console.log("Post error " + String(e));
      console.log("URL: " + url);
      console.log("payload: " + JSON.stringify(payload));
      console.log("config:" + JSON.stringify(config));
      return undefined;
    }
  }

}






/* Redbox v1.9 api */

export class Redbox1 extends BaseRedbox implements Redbox {

  constructor(cf: Object) {
    super(cf)
    this.version = 'Redbox1';
    this.initApiClient();
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

  /* returns a list of all the items in the
     Redbox of the specified type */
  
  async list(ptype: string, start?:number): Promise<string[]> {
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
	let rest = await this.list(ptype, start + ndocs);
	return list.concat(rest);
      } else {
	return list;
      }
    } catch(e) {
      console.log("Error " + e);
      return [];
    }
  }
  

  /* createRecord - add an object via the api.
     
     @metadata -> object containing the metadata
     @packagetype -> has to match one of the values supported
     by this redbox instance
     @options -> object with the following options
     oid -> to specify the oid
     skipReindex -> skip the reindex process
     
  **/
  
  async createRecord(metadata: Object, packagetype: string, options?: Object): Promise<string|undefined> {
    let url = '/object/' + packagetype;
    let params: Object = {};
    let resp = await this.apipost(url, metadata, options);
    if( resp && 'oid' in resp ) {
      return resp['oid'];
    } else {
      return undefined;
    }
  }

  /* TODO - updated record */

  /* Returns the record, or undefined if it's not
     found */
  
  async getRecord(oid: string): Promise<Object|undefined> {
    try {
      let response = await this.apiget('recordmetadata/' + oid);
      return response;
    } catch(e) {
      console.log("Error " + e);
      return undefined;
    }
  }
  
  /* The record's metadata is metadata about the record, not the
     metadata stored in the record (that's what getRecord returns)
     */
  
  async getRecordMetadata(oid: string): Promise<Object|undefined> {
    try {
      let response = await this.apiget('objectmetadata/' + oid);
      return response;
    } catch(e) {
      console.log("Error " + e);
      return undefined;
    }
  }
  
  
  async updateRecordMetadata(oid: string, md: Object): Promise<Object|undefined> {
    try {
      let response = await this.apipost('objectmetadata/' + oid, md);
      return response;
    } catch(e) {
      console.log("Error " + e);
      return undefined;
    }
  }

  async writeDatastream(oid: string, dsid: string, data: any): Promise<Object> {
    try {
      let response = await this.apipost(
        'datastream/' + oid,
        data,
        { datastreamId: dsid }
      );
      return response;
    } catch(e) {
      console.log("Error " + e);
    }
  }


  async listDatastreams(oid: string): Promise<Object> {
    try {
      let response = await this.apiget('datastream/' +oid + '/list');
      return response;
    } catch(e) {
      console.log("Error " + e);
      return undefined;
    }
  }
  
  async readDatastream(oid: string, dsid: string): Promise<any> {
    try {
      let response = await this.apiget('datastream/' + oid, { datastreamId: dsid });
      return response;
    } catch(e) {
      console.log("Error " + e);
    }
  }
}




/* Redbox v2.0 api */

export class Redbox2 extends BaseRedbox implements Redbox {

  branding: string;
  portal: string;

  // Note: not using http://host/branding/portal/api as the base URL because
  // the endpoint I'm using to search is not on the api

  constructor(cf: Object) {
    super(cf);
    this.version = 'Redbox2';
    this.branding = cf['branding'];
    this.portal = cf['portal'];
    this.baseURL += '/' + this.branding + '/' + this.portal;
    this.initApiClient();
  }  

  
  async info(): Promise<Object> {
    return {};
  }

  
  async list(ptype: string, start?:number): Promise<string[]> {
    console.log("About to list");
    if( start === undefined ) {
      start = 0;
    }

    const pagen = 10;
    
    try {
      if( this.progress ) {
	this.progress(util.format("Searching for %s: %d", ptype, start));
      }
      let params = { recordType: ptype, start: start, rows: String(pagen) };
      let resp = await this.apiget('listRecords', params);
      let response = resp["response"];
      let numFound = response["numFound"];
      let docs = response["items"];
      let ndocs = docs.length
      let list = docs.map(d => d.id);
      if( start + ndocs < numFound ) {
	let rest = await this.list(ptype, start + ndocs);
	return list.concat(rest);
      } else {
	return list;
      }
    } catch(e) {
      console.log("Error " + e);
      return [];
    }
  }


  /* createRecord - add an object via the api.
     
     @metadata -> object containing the metadata
     @packagetype -> has to match one of the values supported
     by this redbox instance
     @options -> object with the following options
     oid -> to specify the oid
     skipReindex -> skip the reindex process
     
  **/
  
  async createRecord(metadata: Object, packagetype: string, options?: Object): Promise<string|undefined> {
    let url = 'api/records/metadata/' + packagetype;
    let params: Object = {};
    let resp = await this.apipost(url, metadata, options);
    if( resp && 'oid' in resp ) {
      return resp['oid'];
    } else {
      return undefined;
    }
  }

  /* TODO - updated record */

  /* Returns the record, or undefined if it's not
     found */
  
  async getRecord(oid: string): Promise<Object|undefined> {
    try {
      let response = await this.apiget('api/records/metadata/' + oid);
      return response;
    } catch(e) {
      console.log("Error " + e);
      return undefined;
    }
  }
  
  /* The record's metadata is metadata about the record, not the
     metadata stored in the record (that's what getRecord returns)
     */
  
  async getRecordMetadata(oid: string): Promise<Object|undefined> {
    try {
      let response = await this.apiget('api/objectmetadata/' + oid);
      return response;
    } catch(e) {
      console.log("Error " + e);
      return undefined;
    }
  }
  
  
  async updateRecordMetadata(oid: string, md: Object): Promise<Object|undefined> {
    try {
      let response = await this.apipost('/records/metadata/' + oid, md);
      return response;
    } catch(e) {
      console.log("Error " + e);
      return undefined;
    }
  }

  async writeDatastream(oid: string, dsid: string, data: any): Promise<Object> {
    try {
      let response = await this.apipost(
        'datastream/' + oid,
        data,
        { datastreamId: dsid }
      );
      return response;
    } catch(e) {
      console.log("Error " + e);
    }
  }


  async listDatastreams(oid: string): Promise<Object> {
    try {
      let response = await this.apiget('datastream/' +oid + '/list');
      return response;
    } catch(e) {
      console.log("Error " + e);
      return undefined;
    }
  }
  
  async readDatastream(oid: string, dsid: string): Promise<any> {
    try {
      let response = await this.apiget('datastream/' + oid, { datastreamId: dsid });
      return response;
    } catch(e) {
      console.log("Error " + e);
    }
  }
}












