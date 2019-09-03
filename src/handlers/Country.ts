import {Handler, HandlerBase} from './handlers';
import * as _ from 'lodash';
import {getCountryName} from '../utils/helpers'

export class Country extends HandlerBase implements Handler {

  crosswalk(o: Object): Object | undefined {
    const countryName = getCountryName(o['country']);
    return countryName;
  }
}
