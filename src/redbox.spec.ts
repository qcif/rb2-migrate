//
// Provisioner - (c) 2018 University of Technology Sydney
//
// Tests for Redbox API


import { Redbox } from './redbox';
import { expect } from 'chai';

const fs = require('fs-extra');
const config = require('config');

const TEST19PTS = [ 'dmpt', 'dataset', 'self-submission' ];
const TEST20PTS = [ 'rdmp', 'workspace', 'dataRecord', 'dataPublication' ];



const FIXTURES = {
    'dmpt': './test/rdmp.json'
};




function rbconnect(server: string):Redbox {
    const baseURL = config.get('servers.' + server + '.url');
    const apiKey = config.get('servers.' + server + '.apiKey');
    return new Redbox(baseURL, apiKey);
}

describe('Redbox', function() {
    this.timeout(10000);

    it('can fetch lists of objects from 1.9', async () => {
	const rb = rbconnect('Test1_9');
	for( var i in TEST19PTS ) {
	    let pt = TEST19PTS[i];
	    const oids = await rb.search(pt);
            expect(oids).to.not.be.empty;
	}
    });

    it('can fetch a metadata object from 1.9', async () => {
	const rb = rbconnect('Test1_9');
	const oids = await rb.search('dmpt');
        expect(oids).to.not.be.empty;
	const oid = oids[0];
	const md = await rb.getObject(oid);
	expect(md).to.not.be.null;
	expect(md['oid']).to.equal(oid);
	
    });

    it('can create a metadata object in 1.9', async () => {
	const rb = rbconnect('Test1_9');
	const mdf = await fs.readFile(FIXTURES['dmpt']);
	const oid = await rb.createObject(mdf, 'dmpt');
	expect(oid).to.not.be.null;
	const md2 = await rb.getObject(oid);
	expect(md2).to.not.be.null;
	const md1 = JSON.parse(mdf);
	expect(md2).to.deep.equal(md1);
    });

});
