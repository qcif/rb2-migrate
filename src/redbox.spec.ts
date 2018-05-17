//
// Provisioner - (c) 2018 University of Technology Sydney
//
// Tests for Redbox.ts

// Note that these tests aren't running because the 

import { Redbox } from './redbox';
import { expect } from 'chai';

const config = require('config');

const TEST19PTS = [ 'dmpt', 'dataset', 'self-submission' ];


function rbconnect(server: string):Redbox {
    const baseURL = config.get('servers.' + server + '.url');
    const apiKey = config.get('servers.' + server + '.apiKey');
    return new Redbox(baseURL, apiKey);
}

describe('Redbox', function() {

    it('can fetch lists of objects from 1.9', async () => {
	this.timeout(10000);
	const rb = rbconnect('Test1_9');
	for( var i in TEST19PTS ) {
	    let pt = TEST19PTS[i];
	    const oids = await rb.search(pt);
            expect(oids).to.not.be.empty;
	}
    });

    it('can fetch a metadata object from 1.9', async () => {
	this.timeout(10000);
	const rb = rbconnect('Test1_9');
	const oids = await rb.search('dmpt');
        expect(oids).to.not.be.empty;
	const oid = oids[0];
	const md = await rb.recordmeta(oid);
	expect(md).to.not.be.null;
	expect(md['oid']).to.equal(oid);
    });

});
