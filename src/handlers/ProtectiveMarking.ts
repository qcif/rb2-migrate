// GrantBody handler

import {Handler, HandlerBase} from './handlers';
import * as _ from 'lodash';


export class ProtectiveMarking extends HandlerBase implements Handler {

	crosswalk(o: Object): Object | undefined {
    let value = _.replace(o, 'protectiveMarking.dc', 'protectiveMarking_dc');
		return value;

	}
}
