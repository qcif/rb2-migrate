// GrantBody handler

import {Handler, HandlerBase} from './handlers';


export class GrantBody extends HandlerBase implements Handler {

	crosswalk(o: Object): Object | undefined {

		return {
			'dc_title': o['dc_title'],
			'dc_identifier': [o ['dc_identifier']],
			'grant_number': o['grant_number'],
			'repository_name': [
				'Research Activities'
			]
		};
	}

}
