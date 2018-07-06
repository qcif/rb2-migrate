
// Pluggable field handlers (see ./index.ts in this directory for
// more info)

import { LogCallback } from '../types';

export interface Handler {

	logger: LogCallback;
	params: Object; 

	// note: might need crosswalk to be async if it needs to do a lookup
	// somewhere

	crosswalk(orig: Object): Object|undefined; 

}

export abstract class HandlerBase {

	logger: LogCallback;
	params: Object; 

	constructor(l: LogCallback, p?: Object) {
		this.logger = l;
		if( p ) {
			this.params = p;
		} else {
			this.params = {};
		}
	}

	abstract crosswalk(orig: object): Object;

}
