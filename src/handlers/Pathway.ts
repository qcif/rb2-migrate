import {Handler, HandlerBase} from './handlers';
import * as _ from 'lodash';

export class Pathway extends HandlerBase implements Handler {

  crosswalk(o: Object): Object | undefined {
    // crosswalk(o: Object): Object | undefined {
    //   return super.crosswalk(_.assign(o, {'type': 'url'}));
    // }

    // console.log('incoming object is');
    // console.dir(o);
    const result = {};
    for (const dest of this.config['destinations']) {
      // result[dest["to"]] = {};
      result['nodes'] = {};
      result['edges'] = [];
      _.each(o, function (value, key) {
        //console.log(`next key to handle is: ${key}`);
        let output = {
          'content': value['content'],
          // 'nextStep': value['nextStep'],
          // 'key': value['key'],
          'type': value['type']
        };
        if (!_.isEmpty(value['subType'])) {
          _.set(output, 'subType', value['subType']);
        }
        if (!_.isEmpty(value['hasHelp'])) {
          _.set(output, 'helpId', value['hasHelp']);
        }
        let nextPathway = value['pathway'];
        if (_.isEmpty(result['pathway'])) {
          _.set(result, `pathway`, value['pathway']);
        } else if (result['pathway'] !== value['pathway']) {
          // DO NOT handle multiple pathways from source...yet. Throw error for NOW.
          throw new Error(`Cannot have more than one pathway for incoming source...${result['pathway']} not ${value['pathway']}`);
        } else {
          // current and incoming pathway ID match so continue :)
        }
        //console.log(`output will be: ${JSON.stringify(output, null, 4)}`);
        //console.log(`result before is: ${JSON.stringify(result, null, 4)}`);
        // _.set(result, `nodes.${key}`, output);
        //console.log(`will set at: nodes.${value['key']}`);
        _.set(result, `nodes.${value['key']}`, output);
        //console.log(`result after is: ${JSON.stringify(result, null, 4)}`);
        if (!_.isEmpty(value['nextStep']) && !_.includes(['selfCloses'], _.camelCase(value['nextStep']))) {
          // nextStep could be string or array
          let asArray = _.split(value['nextStep'], ',');
          //console.log(`have split ${value['nextStep']}`);
          // console.debug(asArray);
          // console.debug(_.castArray(asArray));
          for (let nextNextStep of _.castArray(_.split(value['nextStep'], ','))) {
            let nextEdge = {};
            nextEdge['u'] = value['key'];
            nextEdge['v'] = _.trim(nextNextStep);
            result['edges'].push(nextEdge);
          }
        }
        // _.set(result, `${dest["to"]}.${key}`, {
        //   'content': value['content'],
        //   'nextStep' : value['nextStep'],
        //   'key': value['key'],
        //   'type': value['type']
        // })
      });
    }
    return result;
  }


}
