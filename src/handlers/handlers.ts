
// Pluggable field handlers (see ./index.ts in this directory for
// more info)

import { LogCallback } from '../types';

export interface Handler {

	logger: LogCallback;
	config: Object; 

	// note: might need crosswalk to be async if it needs to do a lookup
	// somewhere

	crosswalk(orig: Object): Object|undefined; 

}

// 'config' is the clause invoking this handler in the crosswalk/recordType.json
// file, so that handlers can have parameters. For an example, see Person.ts

export abstract class HandlerBase {

	logger: LogCallback;
	config: Object; 

	constructor(l: LogCallback, c: Object) {
		this.logger = l;
		this.config = c;
	}

	abstract crosswalk(orig: object): Object;

}
