//
// Provisioner - (c) 2018 University of Technology Sydney
//
// Tests for Redbox API

import { Redbox } from './Redbox';
import { Redbox1 } from './Redbox1';
import { Redbox2 } from './Redbox2';



import { expect } from 'chai';
const path = require('path');

const fs = require('fs-extra');
const config = require('config');
const _ = require('lodash');

const SERVERS = [ 'Test2_0' ]; //, Test1_9 'Test2_0' ];

const PTS = {
  'Test1_9': [ 'dmpt', 'dataset', 'self-submission' ],
  'Test2_0': [ 'rdmp', 'dataRecord', 'dataPublication',  'workspace' ]
};

// mark

const SKIP = {
	'Test1_9': {
		create_record: 1,
		grant_view_permission: 1,
		grant_edit_permission: 1
	},
	'Test2_0': { 
		fetch_list: 1,
		create_record: 1
	}
};

const DIAG = './diag';

// most of these fixtures don't need to be set by
// package type

const FIXTURES = {
  'rdmp': {
    'Test1_9': {
      'type': 'dmpt',
      'data': './test/rdmp.json',
      'diag': './test/diag/Test1_9',
      'apiuser': 'admin',
      'user': 'user1',
      'permissions': {
        'view' : [ 'admin' ],
        'edit' : [ 'admin' ]
      }
    },
    'Test2_0': {
      'type': 'rdmp',
      'data': './test/rdmp.json',
      'diag': './test/diag/Test2_0',
      'apiuser': 'admin',
      'user': 'user1',
      'permissions': {
        'viewRoles' : [ 'Admin', 'Librarians' ],
        'editRoles' : [ 'Admin', 'Librarians' ],
        'view' : [ 'admin' ],
        'edit' : [ 'admin' ],
        'viewPending': [],
        'editPending': []
      }
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

async function makerecord(rb:Redbox, server: string): Promise<string> {
  const ptype = FIXTURES['rdmp'][server]['type'];
  const mdj = await fs.readFile(FIXTURES['rdmp'][server]['data']);
  return await rb.createRecord(mdj, ptype);
}


describe('Redbox', function() {
  SERVERS.forEach(server => {
    const rb = rbconnect(server);
    this.timeout(40000);
    
  
    it('can fetch lists of objects from ' + server, async () => {
    	if( !SKIP[server]['fetch_list'] ) {
      	for( var i in PTS[server] ) {
        	let pt = PTS[server][i];
        	const oids = await rb.list(pt);
        	expect(oids).to.not.be.empty;
      	}
      }
    });
    
    it('can fetch a record from ' + server, async () => {
    	if( !SKIP[server]['fetch_record'] ) {
	      const oids = await rb.list(PTS[server][0]);
  	    expect(oids).to.not.be.empty;
    	  const oid = oids[0];
     	 	const md = await rb.getRecord(oid);
     	 	expect(md).to.not.be.null;
      	expect(md['oid']).to.equal(oid);
    	} 
    });
    
    it('can create a record in ' + server, async () => {
    	if( !SKIP[server]['create_record'] ) {
      	const oid = await makerecord(rb, server);
      	expect(oid).to.not.be.null;

      	var md2 = await rb.getRecord(oid);
      	expect(md2).to.not.be.null;

      	const mdf2 = path.join(FIXTURES['rdmp'][server]['diag'], oid + '.out.json');
      	await fs.writeJson(mdf2, md2);
      	console.log("Wrote retrieved JSON to " + mdf2); 
      	const mdj = await fs.readFile(FIXTURES['rdmp'][server]['data']);
      	const md1 = JSON.parse(mdj);
      	expect(md2).to.deep.equal(md1);
      }
    });

    it('can read permissions from ' + server, async () => {
    	if( !SKIP[server]['read_permissions'] ) {
      	const oid = await makerecord(rb, server);

      	const perms = await rb.getPermissions(oid);
      	expect(perms).to.not.be.undefined;

      	expect(perms).to.deep.equal(FIXTURES['rdmp'][server]['permissions']);
      }
    })

    it('can set view permissions in ' + server, async () => {
    	if( !SKIP[server]['grant_view_permission'] ) {
    		const users = [ FIXTURES['rdmp'][server]['user'] ];
    		await test_permissions(rb, server, 'view', 'user', users);
      } 
    })

    it('can set edit permissions in ' + server, async () => {
    	if( !SKIP[server]['grant_edit_permission'] ) {
    		const users = [ FIXTURES['rdmp'][server]['user'] ];
    		await test_permissions(rb, server, 'edit', 'user', users);
      }
    })

    
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


// generalised permission test
// usertype = 'view', 'edit', 'viewPending', 'editPending'
// perm = 'view' or 'edit' (even for pending)
// users = list of user ids

async function test_permissions(rb, server, perm, usertype, users) {

 	const oid = await makerecord(rb, server);

 	const perms1 = await rb.getPermissions(oid);
 	expect(perms1).to.not.be.undefined;

 	const resp = await rb.grantPermission(oid, perm, { usertype: users}  );

 	var nperms = _.cloneDeep(FIXTURES['rdmp'][server]['permissions']);
 	nperms[perm].push(users);

 	expect(resp).to.deep.equal(nperms);
}






