sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Controller, JSONModel, MessageToast, Filter, FilterOperator) {
    "use strict";

    return Controller.extend("dccs.ui5.costgroups.controller.CostGroups", {
        onInit: function () {
            var oViewModel = new JSONModel({
                totalEntries: 0,
                busy: true
            });
            this.getView().setModel(oViewModel, "viewModel");
            var oModel = this.getOwnerComponent().getModel();
            if (oModel) {
                this.getView().setModel(oModel);
                this._readDataCount();
            } else {
                MessageToast.show(this._getText("errorModelNotFound"));
            }
            // Ensure filter bar and button are visible and set correct text
            this._setFilterButtonText();

            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.getRoute("RouteCostGroupDetail").attachPatternMatched(this._onObjectMatched, this);
        },

        onAfterRendering: function () {
            var oTable = this.byId("costGroupsTable");
            if (!oTable) { return; }
            var oBinding = oTable.getBinding("items");
            if (oBinding && !oBinding._dataReceivedAttached) {
                oBinding.attachDataReceived(this.onDataReceived.bind(this));
                oBinding._dataReceivedAttached = true;
            }
        },

        _readDataCount: function () {
            var oModel = this.getView().getModel();
            var that = this;
            if (!oModel) { return; }
            oModel.read("/xdccsxcng_cgpov/$count", {
                success: function (iCount) {
                    var i = parseInt(iCount, 10) || 0;
                    that.getView().getModel("viewModel").setProperty("/totalEntries", i);
                    that.getView().getModel("viewModel").setProperty("/busy", false);
                },
                error: function () {
                    that.getView().getModel("viewModel").setProperty("/totalEntries", 0);
                    that.getView().getModel("viewModel").setProperty("/busy", false);
                }
            });
        },

        onDataReceived: function (oEvent) {
            var oTable = this.byId("costGroupsTable");
            var oBinding = oTable && oTable.getBinding("items");
            var iLength = 0;
            if (oBinding && typeof oBinding.getLength === "function") {
                iLength = oBinding.getLength();
            } else if (oTable) {
                iLength = oTable.getItems().length;
            }
            var oVM = this.getView().getModel("viewModel");
            oVM.setProperty("/totalEntries", iLength);
            oVM.setProperty("/busy", false);
        },

        onRowPress: function (oEvent) {
            var oCtx = oEvent.getSource().getBindingContext();
            if (!oCtx) { return; }
            var oData = oCtx.getObject();
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("RouteCostGroupDetail", {
                costGroupId: oData.CostGrpId
            });
        },

        _getText: function (sKey, aArgs) {
            var oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            return oBundle.getText(sKey, aArgs);
        },

        

        // Toggle filter bar visibility
        onHideFilter: function () {
            var oFilterBarContent = this.byId("filterBarContent");
            if (!oFilterBarContent) { return; }
            var bVisible = oFilterBarContent.getVisible();
            oFilterBarContent.setVisible(!bVisible);
            this._setFilterButtonText();
        },
        _setFilterButtonText: function () {
            var oFilterBarContent = this.byId("filterBarContent");
            var oButton = this.byId("hideFilterBtn");
            if (oButton && oFilterBarContent) {
                var bVisible = oFilterBarContent.getVisible();
                oButton.setText(bVisible ? this._getText("hideFilter") : this._getText("showFilter"));
                oButton.setVisible(true);
            }
        },


        // Apply filters
        onFilterChange: function () {
            var aFilters = [];
            var sCostGroup = this.byId("costGroupInput").getValue();
            var sDescription = this.byId("descInput").getValue();

            if (sCostGroup) {
                aFilters.push(new Filter("costgrptype_text", FilterOperator.Contains, sCostGroup));
            }
            if (sDescription) {
                aFilters.push(new Filter("info_text", FilterOperator.Contains, sDescription));
            }
            
            var oTable = this.byId("costGroupsTable");
            if (!oTable) { return; }
            var oBinding = oTable.getBinding("items");
            if (oBinding) {
                // Use AND condition only if there are multiple filters
                if (aFilters.length > 1) {
                    oBinding.filter(new Filter(aFilters, true));
                } else {
                    oBinding.filter(aFilters);
                }
            }
            // Don't call _readDataCount() after filtering as it may cause server errors
        },

        onLegendPress: function (oEvent) {
            var oView = this.getView();
            if (!this._oLegendPopover) {
                sap.ui.core.Fragment.load({
                    name: "dccs.ui5.costgroups.view.LegendPopover",
                    type: "XML",
                    controller: this
                }).then(function(oPopover) {
                    this._oLegendPopover = oPopover;
                    oView.addDependent(oPopover);
                    oPopover.openBy(oEvent.getSource());
                }.bind(this));
            } else {
                this._oLegendPopover.openBy(oEvent.getSource());
            }
        },

        onAddCostGroup: function () {
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("RouteAddCostGroup");
        },

        _onObjectMatched: function (oEvent) {
            var costGroupId = oEvent.getParameter("arguments").costGroupId;
            // Use costGroupId to load data or update the view
        }
    });
});