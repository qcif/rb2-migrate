import {BaseRedbox, Redbox} from "./Redbox";
import {Redbox1} from "./Redbox1";
import * as assert from 'assert';

import axios from 'axios';

import {AxiosInstance} from 'axios';
import {Redbox1Files} from "./Redbox1Files";
import csv = require("csvtojson");

const qs = require('qs');
const path = require('path');
const util = require('util');
const _ = require('lodash');
const fs = require('fs-extra');


const OBJECT_METADATA = 'TF-OBJ-META';
const OBJECT_RE = /^([^=]+)=(.+)/;
const PACKAGE_KEY = 'jsonConfigPid';

const WORKFLOW_METADATA = 'workflow.metadata';
const WORKFLOW_RE = /"step":\s+"([^"]+)"/;



/* Hacking a "redbox 1.x" api which just gets the JSON from 
   a copy of the storage/ files

	NOTE: this now subclasses Redbox1 so that it can use the API to get
	records, because that doesn't require the solr index

 */


export class Redbox1CsvFiles extends Redbox1 implements Redbox {

  files: string;
  index: Object;
  count_files: number;
  count_errors: number;
  count_success: number;
  errors: Object;
  loaded: boolean;


  constructor(cf: Object) {
    super(cf);
    this.version = 'Redbox1Files';
  }

  // // just get csv list
  // async list(filter: object, csvFile: string): Promise<any> {
  //   csv().fromFile(csvFile)
  //     .subscribe((json, lineNumber) => {
  //       return new Promise((resolve, reject) => {
  //         console.log('getting next line');
  //         return Promise.resolve(json);
  //         // return Promise.reject((e) => {
  //         //   throw new Error(e)
  //         // });
  //       })
  //     })
  // }

  async info(): Promise<Object> {
    return {
      'description': 'Alternate Redbox1 which uses file storage as the index'
    };
  }

  // async getNumRecords(filt?: Object): Promise<number> {
  //   const records = await this.load_files(filt);
  //   return records.length;
  // }

  /* use the find utility to get a list of .tfpackage files from a tree


     applies filters in a way which mimics Solr queries 


     */

  // async list(filt: Object, start?: number): Promise<string[]> {
  //   console.log("about to list files...")
  //   const records = await this.load_files(filt);
  //   console.log("files have been listed.")
  //   return records.map((r) => {
  //     return r['oid'];
  //   })
  // }

  cleanDate(date: string): string {
    if (typeof (date) === 'string') {
      return date.replace(/\\/g, '');
    } else {
      return date;
    }
  }


  parsePath(sPath: string): string[] {
    const parts = sPath.split('/');
    const d = parts.slice(0, parts.length - 1).join('/');
    const oid = parts.slice(-2)[0];
    const fn = parts.slice(-1)[0];
    return [d, oid, fn];
  }

  async readObjectMetadata(dir: string): Promise<Object> {
    const om = await fs.readFile(path.join(dir, OBJECT_METADATA));
    const o = {};
    om.toString().split('\n').map((l) => {
      const m = l.match(OBJECT_RE);
      if (m) {
        o[m[1]] = m[2];
      }
    });
    return o;
  }


  // 	.splice(-2)[0];
  // }

}

