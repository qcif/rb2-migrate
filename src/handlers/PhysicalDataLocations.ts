import {Handler} from './handlers';
import * as _ from 'lodash';
import {DataLocations} from "./DataLocations";

export class PhysicalDataLocations extends DataLocations implements Handler {

  crosswalk(o: Object): Object | undefined {
    return (_.assign(o, {'type': 'physical'}));
  }

}
