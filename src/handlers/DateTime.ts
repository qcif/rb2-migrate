// DataLocations handler

import {Handler, HandlerBase} from './handlers';
import * as moment from 'moment';

export class DateTime extends HandlerBase implements Handler {

	crosswalk(o: Object): Object | undefined {

		const fromFormat = this.config['fromFormat'];
		const toFormat = this.config['toFormat'];
		const newDate = moment(o).format(fromFormat);

		return moment(newDate).format(toFormat);
	}
}
