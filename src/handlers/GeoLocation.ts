import {Handler, HandlerBase} from './handlers';
import * as _ from 'lodash';


export class GeoLocation extends HandlerBase implements Handler {

  crosswalk(o: Object): Object | undefined {
    let repeatable: boolean = this.config['repeatable'] || false;
    const output = {
      repeatable: repeatable
    };

    const self = this;
    const returnFn = moreOutput => {
      _.assign(output, moreOutput);
      if (self.config['destinations']) {
        return self.buildDestinations(output, self.config['destinations']);
      }
      return output;
    };

    if (o['geo:lat']) {
      return returnFn(this.getGeoLat(o));
    } else if (o['redbox:wktRaw']) {
      return returnFn(this.getGeometryDrawing(o));
    } else {
      return returnFn({'basic_name': o['basic_name']});
    }
  }

  getGeoLat(o: Object): Object {
    return {
      'lat': o['lat'],
      'long': o['long'],
      'identifier': o['identifier'],
      'basic_name': o['basic_name']
    }
  }

  getGeometryDrawing(o: Object): Object {
    const geometryInput = (o['redbox:wktRaw']);
    let geometry = {};
    let sanitized = null;
    _.forEach({
      "POLYGON": "Polygon",
      "LINESTRING": "LineString",
      "POINT": "Point"
    }, function (redbox2, redbox1) {
      let sanitized0 = _.replace(geometryInput, redbox1, "");
      if (geometryInput.length > sanitized0.length) {
        sanitized = _.trim(sanitized0, '()');
        geometry['type'] = redbox2;
        return false;
      }
    });
    geometry['coordinates'] = [];
    let coordinates = geometry['coordinates'];
    if (geometry['type'] === 'Polygon') {
      coordinates.push([]);
      coordinates = coordinates[0];
    }
    _.forEach(_.split(sanitized, ','), function (pair, key) {
      const nextPair = _.split(pair, " ");
      // ensure Point has only 1 set of square brackets, not 2
      if (geometry['type'] === 'Point') {
        geometry['coordinates'] = nextPair;
      } else {
        coordinates.push(([nextPair[0], nextPair[1]]));
      }
    });
    return {"geometry": geometry, "type": "Feature", "redbox:Fid": o["redbox:Fid"]};
  }

  buildDestinations(o: Object, destinations: Array<String>): Object {
    return _.reduce(destinations, (result, dest) => {
      if ((dest['to'] === 'geospatial' && _.has(o, 'geometry')) ||
        (dest['to'] === 'geolocations' && !_.has(o, 'geometry'))
      ) {
        const changeOutput = _.cloneDeep(o);
        changeOutput['repeatable'] = dest['repeatable'] || changeOutput['repeatable'];
        changeOutput['destination'] = dest['to'];
        if (!_.isEmpty(dest['nestedNames'])) {
          changeOutput['nestedNames'] = dest['nestedNames'];
        }
        if (!_.isEmpty(dest['additionalKeys'])) {
          changeOutput['additionalKeys'] = dest['additionalKeys'];
        }
        result.push(changeOutput);
      }
      return result;
    }, []);
  }

}
