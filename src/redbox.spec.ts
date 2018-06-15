//
// Provisioner - (c) 2018 University of Technology Sydney
//
// Tests for Redbox API


import { Redbox, Redbox1, Redbox2 } from './redbox';
import { expect } from 'chai';

const fs = require('fs-extra');
const config = require('config');

const SERVERS = [ 'Test2_0' ];

const PTS = {
  'Test1_9': [ 'dmpt', 'dataset', 'self-submission' ],
  'Test2_0': [ 'rdmp', 'dataRecord', 'dataPublication',  'workspace' ]
};


const FIXTURES = {
  'rdmp': {
    'Test2_0': {
      'type': 'rdmp',
      'data': './test/rdmp.json'
    },
    'Test1_9': {
      'type': 'dmpt',
      'data': './test/rdmp.json'
    },
  },
  'image': './test/image.jpg',
};




function rbconnect(server: string):Redbox {
  const cf = config.get('servers.' + server);
  if( cf['version'] === 'Redbox1' ) {
    return new Redbox1(cf);
  } else {
    return new Redbox2(cf);
  }
}


describe('Redbox', function() {
  SERVERS.forEach(server => {
    this.timeout(10000);
  
    it.skip('can fetch lists of objects from ' + server, async () => {
      console.log("Trying to connect");
      const rb = rbconnect(server);
      console.log("Afterwards " + rb);
      for( var i in PTS[server] ) {
        let pt = PTS[server][i];
        console.log("Package type " + pt);
        const oids = await rb.list(pt);
        expect(oids).to.not.be.empty;
      }
    });
    
    it.skip('can fetch a record from ' + server, async () => {
      const rb = rbconnect(server);
      const oids = await rb.list(PTS[server][0]);
      expect(oids).to.not.be.empty;
      const oid = oids[0];
      const md = await rb.getRecord(oid);
      expect(md).to.not.be.null;
      expect(md['oid']).to.equal(oid);
      
    });
    
    it('can create a record in ' + server, async () => {
      const rb = rbconnect(server);
      const ptype = FIXTURES['rdmp'][server]['type'];
      const mdf = await fs.readFile(FIXTURES['rdmp'][server]['data']);
      const oid = await rb.createRecord(mdf, ptype);
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


