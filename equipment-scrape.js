const requestPromise = require('request-promise-native');
const cheerio = require('cheerio');
const fs = require('fs');

const dndURL = 'https://www.dndbeyond.com';
const equipmentURL = dndURL + '/equipment';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const options = {
  url: equipmentURL,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:66.0) Gecko/20100101 Firefox/66.0',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  },
  transform: function(body) {
    return cheerio.load(body);
  }
};

function scrape() {
  requestPromise(options)
    .then(async $ => {
      const numPages = $('.b-pagination-list')
        .children()
        .last()
        .prev()
        .text();
      console.log(`Found ${numPages} pages...`);

      const equipmentURLs = [];

      for (let i = 1; i <= numPages; i++) {
        console.log(`Downloading page ${i}...`);
        let page = await requestPromise(`${equipmentURL}?page=${i}`);
        let pageDOM = cheerio.load(page);
        pageDOM('ul.listing')
          .find('div.list-row-name-primary-text > a')
          .each((index, el) => {
            let href = pageDOM(el).attr('href');
            equipmentURLs.push(href);
          });
      }

      console.log('Scraped item URLS...');
      console.log('Total of ' + equipmentURLs.length + ' item pages.');

      let equipmentObjects = [];
      for (const itemURL of equipmentURLs) {
        options.url = dndURL + itemURL;
        let htmlString = await requestPromise(dndURL + itemURL);
        let $$ = cheerio.load(htmlString);
        let equipmentObj = {};

        equipmentObj.name = $$('h1.page-title')
          .text()
          .trim();

        equipAttrs = $$(
          'div.details-container-content-description-text'
        ).children();
        equipmentObj.type = equipAttrs
          .first()
          .text()
          .trim();
        equipmentObj.cost = equipAttrs
          .first()
          .next()
          .text()
          .trim();
        equipmentObj.weight = equipAttrs
          .first()
          .next()
          .next()
          .text()
          .trim();

        equipmentObj.description = $$(
          'div.details-container-content-description > div.details-container-content-description-text'
        )
          .html()
          .replace(/\s\s+/g, ' ')
          .replace(/<\s*a[^>]*>/g, '')
          .replace(/<\s*\/\s*a>/g, '')
          .trim();

        equipmentObj.tags = [];
        $$('.tag').each((i, e) => {
          equipmentObj.tags.push($$(e).text());
        });

        equipmentObj.img_url = $$('div.image-container > a').attr('href');
        equipmentObjects.push(equipmentObj);
        console.log(`Added ${equipmentObj.name}...`);
        await sleep(Math.random() * 1000);
      }

      var json = JSON.stringify(equipmentObjects, null, 2);
      fs.writeFile(`json/SRD_5e_Equipment.json`, json, 'utf8', function(err) {
        if (err) throw err;
        console.log('complete');
      });
    })
    .catch(error => console.log(error));
}

scrape();
