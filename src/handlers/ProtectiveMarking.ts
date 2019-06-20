// GrantBody handler

import {Handler, HandlerBase} from './handlers';


export class ProtectiveMarking extends HandlerBase implements Handler {

	crosswalk(o: Object): Object | undefined {

		var value = o[Object.keys(o)[0]];

		return value;

	}
}
