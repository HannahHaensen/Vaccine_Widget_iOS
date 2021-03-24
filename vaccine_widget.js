/**
 *
 * AUTHOR:
 * Code is adapted from:
 *    CREDITS: https://github.com/rphl - https://github.com/rphl/corona-widget/
 * data from: https://interaktiv.morgenpost.de/data/corona/rki-vaccinations.json
 * inspired by https://impfdashboard.de/data/germany_vaccinations_timeseries_v2.1f32bff3.tsv
 * https://impfdashboard.de/data/germany_vaccinations_by_state.93a1bc58.tsv
 */

const CFG = {
  openUrl: false,
  scriptRefreshInterval: 28800, // refresh after 8 hours (in seconds)
  scriptSelfUpdate: false, // script updates itself,
}

const ENV = {
  vaccinationColors: {
    green: { limit: 1, color: new Color('#00cc00') },
    gray: { limit: 0, color: new Color('#d0d0d0') }
  },
  fonts: {
    xlarge: Font.boldSystemFont(26),
    large: Font.mediumSystemFont(20),
    medium: Font.mediumSystemFont(14),
    normal: Font.mediumSystemFont(12),
    small: Font.boldSystemFont(11),
    small2: Font.boldSystemFont(10),
    xsmall: Font.boldSystemFont(9)
  },
  status: {
    offline: 418,
    notfound: 404,
    error: 500,
    ok: 200
  },
  isSmallWidget: config.widgetFamily === 'small',
  isSameState: false,
  cache: {},
  staticCoordinates: [],
  script: {
    selfUpdate: CFG.scriptSelfUpdate,
    filename: this.module.filename.replace(/^.*[\\\/]/, ''),
    updateStatus: ''
  }
}

class UI {
  constructor(view) {
    if (view instanceof UI) {
      this.view = this.elem = view.elem
    } else {
      this.view = this.elem = view
    }
  }

  stack(type = 'h', padding = false, borderBgColor = false, radius = false, borderWidth = false, size = false) {
    this.elem = this.view.addStack()
    if (radius) this.elem.cornerRadius = radius
    if (borderWidth !== false) {
      this.elem.borderWidth = borderWidth
      this.elem.borderColor = new Color(borderBgColor)
    } else if (borderBgColor) {
      this.elem.backgroundColor = new Color(borderBgColor)
    }
    if (padding) this.elem.setPadding(...padding)
    if (size) this.elem.size = new Size(size[0], size[1])
    if (type === 'h') { this.elem.layoutHorizontally() } else { this.elem.layoutVertically() }
    this.elem.centerAlignContent()
    return this
  }
  text(text, font = false, color = false, maxLines = 0, minScale = 0.9) {
    let t = this.elem.addText(text)
    if (color) t.textColor = (typeof color === 'string') ? new Color(color) : color
    t.font = (font) ? font : ENV.fonts.normal
    t.lineLimit = (maxLines > 0 && minScale < 1) ? maxLines + 1 : maxLines
    t.minimumScaleFactor = minScale
    return this
  }
  space(size) {
    this.elem.addSpacer(size)
    return this
  }
}

class UIComp {
  static vaccineRow(view, vaccinated, vaccinated_raw, name, bgColor = '#99999915') {
    let b = new UI(view).stack('v', false, '#99999915', 12)
    let b2 = new UI(b).stack('h', [4, 0, 0, 5])
    b2.space()
    b2.text(vaccinated, ENV.fonts.small2, ENV.vaccinationColors.gray.color, 1, 1)
    let trendColor =  ENV.vaccinationColors.green.color
    b2.text('↑', ENV.fonts.small2, trendColor, 1, 1)

    b2.text(name.toUpperCase(), ENV.fonts.small2, '#777', 1, 1)

    let b3 = new UI(b).stack('h', [0, 0, 0, 5])

    b3.space(10)
    const germany_total = 83190556;

    const progress = Number.parseInt(vaccinated_raw) / germany_total * 100;

    this.createProgressBar(progress, b3);
    b3.space()

    b.space(2)
  }

  static createProgressBar(progress, b3) {
    for (let i = 0; i < 100; i += 10) {
      if (progress > i) {
        b3.text("▩", ENV.fonts.normal, ENV.vaccinationColors.green.color, 1, 1);
        // context.setFillColor(ENV.vaccinationColors.green.color)
      } else {
        b3.text("▩️️", ENV.fonts.small, ENV.vaccinationColors.gray.color, 1, 1);
        // context.setFillColor(ENV.vaccinationColors.gray.color)
      }
      // context.fillRect(rect)
    }
  }

  static vaccineBlock(view, vaccinated, vaccinated_raw, name, bgColor = '#99999915') {
    let b = new UI(view).stack('v', false, '#99999915', 5)
    let b2 = new UI(b).stack('h', [4, 0, 0, 5])
    b2.space(2)
    b2.text(vaccinated, ENV.fonts.small2, ENV.vaccinationColors.gray.color, 1, 1)
    let trendColor =  ENV.vaccinationColors.gray.color
    b2.text('↑', ENV.fonts.small2, trendColor, 1, 1)

    b2.text(name.toUpperCase(), ENV.fonts.small2, '#777', 1, 1)
    b2.elem.center
    let b3 = new UI(b).stack('h', [0, 0, 0, 5])

    const germany_total = 83190556;

    const progress = Number.parseInt(vaccinated_raw) / germany_total * 100;
    b3.text(Format.number(progress, 2, 'n/v') , ENV.fonts.small2, ENV.vaccinationColors.gray.color, 1, 1)
    b3.text('%', ENV.fonts.small2, trendColor, 1, 1)

    this.createProgressBar(progress, b3);

    b3.space(2)
  }
}

class Format {
  static dateStr(date = new Date()) {
    return `${('' + date.getDate()).padStart(2, '0')}.${('' + (date.getMonth() + 1)).padStart(2, '0')}.${date.getFullYear()}`
  }
  static number(number, fractionDigits = 0, placeholder = null, limit = false) {
    if (!!placeholder && number === 0) return placeholder
    if (limit !== false && number >= limit) fractionDigits = 0
    return Number(number).toLocaleString('de-DE', { maximumFractionDigits: fractionDigits, minimumFractionDigits: fractionDigits })
  }
}

class VaccineRequest {

  async vaccinatedPeople() {
    const urlVaccine = 'https://interaktiv.morgenpost.de/data/corona/rki-vaccinations.json'
    return await this.exec(urlVaccine);
  }

  async exec(url) {
    let data = {}
    let status = ENV.status.ok
    const request = new Request(url)
    const result = await request.loadJSON();
    console.log("parse vaccinations");
    try {
      // console.log(res);
      if (result && result.length > 0) {
        const res = result[0];
        // console.log(res);
        if (res.cumsum_latest && res.cumsum2_latest && res.cumsum2_latest) {
          data = {
            first_vac: res.cumsum_latest - res.cumsum2_latest,
            second_vac: res.cumsum2_latest,
            date: new Date(res.date)
          }
        }
      }
      // console.log(data);
      status = (typeof data.features !== 'undefined') ? ENV.status.ok : ENV.status.notfound
      return new DataResponse(data, status)
    } catch (e) {
      console.log("reading data failed!");
      console.log(e);
      return new DataResponse({}, ENV.status.notfound)
    }
  }
}

class VaccineWidget {
  constructor() {
  }
  async init() {
    this.widget = await this.createWidget()
    this.widget.setPadding(0, 0, 0, 0)
    if (!config.runsInWidget) {
      (ENV.isSmallWidget) ? await this.widget.presentSmall() : await this.widget.presentMedium()
    }
    Script.setWidget(this.widget)
    Script.complete()
  }
  async createWidget() {
    // Create new empty ListWidget instance

    const listWidget = new ListWidget()

    // Set new background color
    listWidget.backgroundColor = new Color("#000000");

    const data = await vaccineRequest.vaccinatedPeople();
    // console.log(Number(data.data.first_vac).toLocaleString('de-DE'));

    const first_vac = Number(data.data.first_vac).toLocaleString('de-DE');
    const second_vac = Number(data.data.second_vac).toLocaleString('de-DE');

    const first_vac_raw = data.data.first_vac;
    const second_vac_raw = data.data.second_vac;

    let topBar = new UI(listWidget).stack('h', [4, 8, 4, 4])
    topBar.text("💉", Font.mediumSystemFont(16))
    topBar.space(3)

    let topRStack = new UI(topBar).stack('v', [0,0,0,0])
    topRStack.text('Impffortschritt', ENV.fonts.medium)
    let updatedDate = Format.dateStr(data.data.date);
    let updatedTime = ('' + new Date().getHours()).padStart(2, '0') + ':' + ('' + new Date().getMinutes()).padStart(2, '0')
    topRStack.text(updatedDate + ' ' +updatedTime, ENV.fonts.xsmall, '#777777')

    if (ENV.isSmallWidget) {
      UIComp.vaccineRow(listWidget, first_vac, first_vac_raw, "Erstimpfung")
      UIComp.vaccineRow(listWidget, second_vac, second_vac_raw,"Zweitimpfung")
    } else {

      UIComp.vaccineBlock(listWidget, first_vac, first_vac_raw, "Erstimpfung")

      listWidget.addSpacer(3)

      UIComp.vaccineBlock(listWidget, second_vac, second_vac_raw, "Zweitimpfung")

    }
    listWidget.addSpacer(3)

    let stateBar = new UI(listWidget).stack('h', [0, 0, 0, 0])
    stateBar.space(6)

    // Spacer between heading and launch date
    listWidget.addSpacer(15);

    // Return the created widget
    listWidget.refreshAfterDate = new Date(Date.now() + (CFG.scriptRefreshInterval * 1000))

    return listWidget;
  }
}

class DataResponse {
  constructor(data, status = ENV.status.ok) {
    this.data = data
    this.status = status
  }
}

const vaccineRequest = new VaccineRequest();
await new VaccineWidget().init();
Script.complete();

