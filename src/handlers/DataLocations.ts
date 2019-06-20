// DataLocations handler

import {Handler, HandlerBase} from './handlers';
import * as _ from 'lodash';

export class DataLocations extends HandlerBase implements Handler {

  crosswalk(o: Object): Object | undefined {

    let type = '';
    if (o['type']) {
      switch (o['type']) {
        case 'url':
          type = 'url';
          break;
        case 'physical':
          type = 'physical';
          break;
        case 'file':
          type = 'file';
          break;
        case 'attachment':
          this.logger('handler', 'DataLocations', '', 'warning', 'Attachment steps are skipped here and added post.' + o['oid']);
          break;
        default:
          this.logger('handler', 'DataLocations', '', 'warning', 'No type found on ' + o['oid']);
      }
    }

    return !_.isEmpty(o['location']) ? {
      'location': o['location'],
      'type': type,
      'notes': o['notes']
    } : null;
  }

}
