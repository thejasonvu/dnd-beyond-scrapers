const requestPromise = require('request-promise-native');
const cheerio = require('cheerio');
const fs = require('fs');

const dndUrl = 'https://www.dndbeyond.com';
const dndMonsterUrl = dndUrl + '/monsters';
const dndMonsterUrlSrd =
  dndMonsterUrl + '?filter-search=&filter-source=1&filter-type=0';
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const options = {
  url: dndMonsterUrlSrd,
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

      const dndMonsterUrls = [];

      for (let i = 1; i <= numPages; i++) {
        console.log(`Downloading page ${i}...`);
        let page = await requestPromise(`${dndMonsterUrlSrd}&page=${i}`);
        let pageDOM = cheerio.load(page);
        pageDOM('ul.listing')
          .find('span.name > a')
          .each((index, el) => {
            let href = pageDOM(el).attr('href');
            dndMonsterUrls.push(href);
          });
      }

      console.log('Scraped magic item URLS...');
      console.log('Total of ' + dndMonsterUrls.length + ' magic item pages.');
      console.log(dndMonsterUrls);

      let monsterObjects = [];
      for (const monsterUrl of dndMonsterUrls) {
        //options.url = dndUrl + itemURL;
        let htmlString = await requestPromise(dndUrl + monsterUrl);
        let $$ = cheerio.load(htmlString);
        let monsterObj = {};

        monsterObj.name = $$('div.mon-stat-block__name')
          .text()
          .trim();

        monsterObj.meta = $$('div.mon-stat-block__meta')
          .text()
          .trim();

        let attributes = $$('div.mon-stat-block__attributes').children();

        monsterObj.armorClass = attributes
          .first()
          .find('span.mon-stat-block__attribute-data-value')
          .text()
          .trim();
        let armorClassType;
        if (
          attributes.first().find('span.mon-stat-block__attribute-data-extra')
        ) {
          armorClassType = attributes
            .first()
            .find('span.mon-stat-block__attribute-data-extra')
            .text()
            .trim();
        }
        if (armorClassType) monsterObj.armorClassType = armorClassType;

        monsterObj.hitPointsAverage = attributes
          .first()
          .next()
          .find('span.mon-stat-block__attribute-data-value')
          .text()
          .trim();

        monsterObj.hitDice = attributes
          .first()
          .next()
          .find('span.mon-stat-block__attribute-data-extra')
          .text()
          .trim();

        monsterObj.speed = attributes
          .last()
          .find('span.mon-stat-block__attribute-data-value')
          .text()
          .trim();

        let stats = $$('.ability-block').children();
        stats.each((i, stat) => {
          let ability = $(stat)
            .find('.ability-block__heading')
            .text()
            .trim();
          let ability_val = $(stat)
            .find('.ability-block__score')
            .text()
            .trim();
          let mod = $(stat)
            .find('.ability-block__modifier')
            .text()
            .trim();
          monsterObj[ability] = ability_val;
          monsterObj[ability + '_mod'] = mod;
        });

        let tidbits = $$('.mon-stat-block__tidbits').children();
        tidbits.each((i, tidbit) => {
          let tidbitKey = $$(tidbit)
            .find('.mon-stat-block__tidbit-label')
            .text()
            .trim();
          let tidbitValue = $$(tidbit)
            .find('.mon-stat-block__tidbit-data')
            .text()
            .trim();
          monsterObj[tidbitKey] = tidbitValue;
        });

        $$('.mon-stat-block__description-blocks')
          .children()
          .each((i, block) => {
            let key =
              $$(block).find('.mon-stat-block__description-block-heading')
                .length > 0
                ? $$(block)
                    .find('.mon-stat-block__description-block-heading')
                    .text()
                    .trim()
                : 'traits';
            let value = $$(block)
              .find('.mon-stat-block__description-block-content')
              .html()
              .replace(/\s\s+/g, ' ')
              .replace(/\n+/g, '')
              .replace(/<\s*a[^>]*>/g, '')
              .replace(/<\s*\/\s*a>/g, '')
              .trim();
            monsterObj[key] = value;
          });

        if ($$('.mon-details__description-block-content').text() > 0) {
          monsterObj.description = $$('.mon-details__description-block-content')
            .html()
            .replace(/\s\s+/g, ' ')
            .replace(/\n+/g, '')
            .replace(/<\s*a[^>]*>/g, '')
            .replace(/<\s*\/\s*a>/g, '')
            .trim();
        }

        monsterObj.environments = [];
        $$('.environment-tag').each((i, e) => {
          monsterObj.environments.push($$(e).text());
        });

        monsterObj.img_url = $$('div.image > a').attr('href');
        monsterObjects.push(monsterObj);
        console.log(`Added ${monsterObj.name}...`);
        await sleep(Math.random() * 1000);
      }

      var json = JSON.stringify(monsterObjects, null, 2);
      fs.writeFile(`json/SRD_5e_Monsters.json`, json, 'utf8', function(err) {
        if (err) throw err;
        console.log('complete');
      });
    })
    .catch(error => console.log(error));
}

scrape();
