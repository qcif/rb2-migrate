import {Handler, HandlerBase} from './handlers';
import * as _ from 'lodash';


export class CitationSimpleDate extends HandlerBase implements Handler {

  crosswalk(o: object, dateConfig: any): Object | undefined {
    //pick the first date found, based on order of 'type' priorities
    const priorities = dateConfig.priorities;
    const attributeName = dateConfig.attributeName;
    let citationDateChoices = _.filter(o, function (next) {
      return _.includes(priorities, next.type);
    });
    let result;
    for (const nextPriority of priorities) {
      result = _.find(citationDateChoices, function (next) {
        return next.type === nextPriority && !_.isEmpty(next.date)
      });
      if (!_.isEmpty(result)) {
        return {
          [attributeName]: result['date']
        }
      }
    }
  }
}
