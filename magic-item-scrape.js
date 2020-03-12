const requestPromise = require('request-promise-native');
const cheerio = require('cheerio');
const fs = require('fs');

const dndUrl = 'https://www.dndbeyond.com';
const magicUrl = dndUrl + '/magic-items';
const magicUrlSrd = magicUrl + '?filter-search=&filter-source=1&filter-type=0';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const options = {
  url: magicUrlSrd,
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

      const magicUrls = [];

      for (let i = 1; i <= numPages; i++) {
        console.log(`Downloading page ${i}...`);
        let page = await requestPromise(`${magicUrlSrd}&page=${i}`);
        let pageDOM = cheerio.load(page);
        pageDOM('ul.listing')
          .find('span.name > a')
          .each((index, el) => {
            let href = pageDOM(el).attr('href');
            magicUrls.push(href);
          });
      }

      console.log('Scraped magic item URLS...');
      console.log('Total of ' + magicUrls.length + ' magic item pages.');
      console.log(magicUrls);

      let magicItemObjects = [];
      for (const itemURL of magicUrls) {
        //options.url = dndUrl + itemURL;
        let htmlString = await requestPromise(dndUrl + itemURL);
        let $$ = cheerio.load(htmlString);
        let magicItemObj = {};

        magicItemObj.name = $$('h1.page-title')
          .text()
          .trim();

        magicItemObj.meta = $$('div.details span')
          .text()
          .trim();

        $$('div.more-info-content > p.notes-string').remove();

        magicItemObj.description = $$('div.more-info-content')
          .html()
          .replace(/\s\s+/g, ' ')
          .replace(/\n+/g, '')
          .replace(/<\s*a[^>]*>/g, '')
          .replace(/<\s*\/\s*a>/g, '')
          .trim();

        magicItemObj.tags = [];
        $$('.tag').each((i, e) => {
          magicItemObj.tags.push($$(e).text());
        });

        magicItemObj.img_url = $$('div.image > a').attr('href');
        magicItemObjects.push(magicItemObj);
        console.log(`Added ${magicItemObj.name}...`);
        await sleep(Math.random() * 1000);
      }

      var json = JSON.stringify(magicItemObjects, null, 2);
      fs.writeFile(`json/SRD_5e_Magic-Items.json`, json, 'utf8', function(err) {
        if (err) throw err;
        console.log('complete');
      });
    })
    .catch(error => console.log(error));
}

scrape();
