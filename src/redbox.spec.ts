//
// Provisioner - (c) 2018 University of Technology Sydney
//
// Tests for Redbox API


import { Redbox, Redbox1 } from './redbox';
import { expect } from 'chai';

const fs = require('fs-extra');
const config = require('config');

const SERVERS = [ 'Test1_9' ];

const PTS = {
  'Test1_9': [ 'dmpt', 'dataset', 'self-submission' ],
  'Test2_0': [ 'rdmp', 'workspace', 'dataRecord', 'dataPublication' ]
};


const FIXTURES = {
  'dmpt': './test/rdmp.json',
  'image': './test/image.jpg',
};




function rbconnect(server: string):Redbox {
  const baseURL = config.get('servers.' + server + '.url');
  const apiKey = config.get('servers.' + server + '.apiKey');
  const version = config.get('servers.' + server + '.version');
//  if( version === 'Redbox1' ) {
    return new Redbox1(baseURL, apiKey);
//  } else {
//    const brand = config.get('servers.' + server + '.brand');
//    return new Redbox2(baseURL, brand, apiKey);
//  }
}


describe('Redbox', function() {
  SERVERS.forEach(server => {
    this.timeout(10000);
  
    it('can fetch lists of objects from ' + server, async () => {
      const rb = rbconnect(server);
      for( var i in PTS[server] ) {
        let pt = PTS[server][i];
        const oids = await rb.search(pt);
        expect(oids).to.not.be.empty;
      }
    });
    
    it('can fetch a record from ' + server, async () => {
      const rb = rbconnect(server);
      const oids = await rb.search(PTS[server][0]);
      expect(oids).to.not.be.empty;
      const oid = oids[0];
      const md = await rb.getRecord(oid);
      expect(md).to.not.be.null;
      expect(md['oid']).to.equal(oid);
      
    });
    
    it('can create a record in ' + server, async () => {
      const rb = rbconnect(server);
      const mdf = await fs.readFile(FIXTURES['dmpt']);
      const oid = await rb.createRecord(mdf, 'dmpt');
      expect(oid).to.not.be.null;
      const md2 = await rb.getRecord(oid);
      expect(md2).to.not.be.null;
      const md1 = JSON.parse(mdf);
      expect(md2).to.deep.equal(md1);
    });
    
    // Note: rb.writeObjectDatastream needs to set the
    // content-type header to match the payload, I think.
    
    // it('can write and read datastreams in 1.9', async () => {
    //   const rb = rbconnect('Test1_9');
    //   const mdf = await fs.readFile(FIXTURES['dmpt']);
    //   const oid = await rb.createObject(mdf, 'dmpt');
    //   const data = await fs.readFile(FIXTURES['image']);
    //   const dsid = "attachment.jpg";
    //   console.log("About to write object datastream");
    //   const resp = await rb.writeObjectDatastream(oid, dsid, data);
    //   console.log("Response" + JSON.stringify(resp));
    //   const o2 = await rb.getObject(oid);
    //   const data2 = await rb.readObjectDatastream(oid, dsid);
    //   expect(data2).to.equal(data);
    // });
    
  });
});


