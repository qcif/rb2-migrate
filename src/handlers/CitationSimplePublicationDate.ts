import {Handler} from './handlers';
import {CitationSimpleDate} from "./CitationSimpleDate";


export class CitationSimplePublicationDate extends CitationSimpleDate implements Handler {

  crosswalk(o: object): Object | undefined {
    return super.crosswalk(o, {
      priorities: ['publicationDate', 'endPublicationDate', 'startPublicationDate'],
      attributeName: 'citation_publication_date'
    });
  }

}
