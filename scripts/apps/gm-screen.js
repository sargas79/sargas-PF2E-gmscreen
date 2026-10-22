import { I18N, MODULE_ID } from "../constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * The GM screen window. M0 renders a placeholder; tabs and cards arrive in M1.
 *
 * Never reach for the global `document`/`window` in here: the screen can be detached
 * into its own browser window, so use `this.element.ownerDocument` instead.
 */
export class GMScreen extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: MODULE_ID,
    classes: [MODULE_ID],
    window: {
      title: `${I18N}.Title`,
      icon: "fa-solid fa-book-open",
      resizable: true,
    },
    position: {
      width: 900,
      height: 640,
    },
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/gm-screen.hbs`,
    },
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return Object.assign(context, {
      systemVersion: game.system.version,
    });
  }
}
