sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/Fragment",
	"sap/m/MessagePopover"
], function (Controller, Fragment, MessagePopover) {
	"use strict";

	return Controller.extend("dccs.ui5.costgroups.controller.App", {

		onInit: function () {
			this._oMessagePopover = this.getView().byId("myMessagePopover");
		},

		getFragment: function (sFragmentName) {
			return sap.ui.xmlfragment("dccs.ui5.costgroups.view." + sFragmentName, this);
		}
	});
});
