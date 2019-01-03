// DataLocations handler

import {Handler, HandlerBase} from './handlers';
import * as moment from 'moment';

export class DateTime extends HandlerBase implements Handler {

	crosswalk(o: Object): Object | undefined {

		try {
			if (moment(o, this.config['fromFormat'], true).isValid()) {
				const fromFormat = this.config['fromFormat'];
				const toFormat = this.config['toFormat'];
				const newDate = moment(o).format(fromFormat);
				return moment(newDate).format(toFormat);
			} else {
				this.logger('handler', 'DateTime', '', 'error', 'incorrect format provided for' + ' : ' + o['oid']);
				return null;
			}
		} catch (e) {
			this.logger('handler', 'DateTime', '', 'error', e.message + ' : ' + o['oid']);
		}
	}
}
