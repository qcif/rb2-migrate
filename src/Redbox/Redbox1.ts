
import { BaseRedbox, Redbox } from "./Redbox";



/* Redbox v1.9 api */

/* See https://redbox.restlet.io/ */

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

  // async deleteRecord(oid: string): Promise<bool> {
  //   let url = '/object/' + oid + '/delete';
  //   let resp = await this.apidelete(url);
  //   if( resp ) {
  //     return true;
  //   } else {
  //     return false;
  //   }
  // }


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

  /* just getting the owner from the TF-OBJ-META for now */

  async getPermissions(oid: string): Promise<Object|undefined> {
    try {
      let response = await this.getRecordMetadata(oid);
      if( response ) {
        const owner = response['owner'];
        if( owner ) {
          return {
              view: [ owner ],
              edit: [ owner ]
          };
        }
      } else {
        return undefined;
      }
    } catch(e) {
      console.log("Error " + e);
    }
  }


  /* the next two are stubs to satisfy the interface */

  async grantPermission(oid: string, users:Object, permission: string): Promise<Object|undefined> {
    return undefined;
  }

  async removePermission(oid: string, users:Object, permission: string): Promise<Object|undefined> {
    return undefined;
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


