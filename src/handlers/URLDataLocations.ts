import {Handler} from './handlers';
import * as _ from 'lodash';
import {DataLocations} from "./DataLocations";

export class URLDataLocations extends DataLocations implements Handler {

  crosswalk(o: Object): Object | undefined {
    return (_.assign(o, {'type': 'url'}));
  }

}
