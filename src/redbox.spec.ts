//
// Provisioner - (c) 2018 University of Technology Sydney
//
// Tests for Redbox.ts

// Note that these tests aren't running because the 

import { Redbox } from './redbox';
import { expect } from 'chai';

const config = require('config');

const TEST19PTS = [ 'dmpt', 'dataset', 'self-submission' ];



describe('Redboches', function() {

    it('can fetch lists of objects from 1.9', async () => {
	this.timeout(10000);
	const baseURL = config.get('servers.Test1_9.url');
	const apiKey = config.get('servers.Test1_9.apiKey');
	const rb = new Redbox(baseURL, apiKey);
	for( var i in TEST19PTS ) {
	    let pt = TEST19PTS[i];
	    const oids = await rb.search(pt);
            expect(oids).to.not.be.empty;
	}
    });

});
