sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/Dialog",
    "sap/m/Text",
    "sap/m/Button",
    "sap/ui/core/library"
], function (Controller, JSONModel, MessageToast, Filter, FilterOperator, MessageBox, Dialog, Text, Button, coreLibrary) {
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
            oModel.read("/ZSCOSTGRP_CASet/$count", {
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

        onDeleteCostGroup: function (oEvent) {
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext();
            var oData = oContext.getObject();
            var that = this;

            MessageBox.confirm(
                "Are you sure you want to delete the cost group '" + oData.CostGrpName + "'?", 
                {
                    title: "Confirm Deletion",
                    onClose: function (oAction) {
                        if (oAction === MessageBox.Action.OK) {
                            that._deleteCostGroup(oData);
                        }
                    }
                }
            );
        },

        _deleteCostGroup: function (oData) {
            var oModel = this.getView().getModel();
            var sPath = "/ZSCOSTGRP_CASet(CostGrpId='" + oData.CostGrpId + "',Mandt='" + oData.Mandt + "')";
            var that = this;

            oModel.remove(sPath, {
                success: function (oResponse) {
                    // Create success message container
                    var oSuccessMessage = {
                        type: "Success",
                        title: "Deletion Successful",
                        message: "Cost Group '" + oData.CostGrpName + "' has been successfully deleted.",
                        timestamp: new Date().toISOString(),
                        details: {
                            costGroupId: oData.CostGrpId,
                            costGroupName: oData.CostGrpName,
                            operation: "DELETE"
                        }
                    };
                    
                    // Call success handler
                    that.mySuccessHandler(oSuccessMessage);
                    
                    // Refresh the table data
                    that._refreshTable();
                },
                error: function (oError) {
                    // Create error message container
                    var oErrorMessage = {
                        type: "Error",
                        title: "Deletion Failed",
                        message: "Failed to delete cost group '" + oData.CostGrpName + "'. Please try again.",
                        timestamp: new Date().toISOString(),
                        details: {
                            costGroupId: oData.CostGrpId,
                            costGroupName: oData.CostGrpName,
                            operation: "DELETE",
                            errorCode: oError.statusCode || "UNKNOWN",
                            errorText: oError.statusText || "Unknown error occurred"
                        },
                        technicalDetails: oError
                    };
                    
                    // Call error handler
                    that.myErrorHandler(oErrorMessage);
                    
                    // Raise exception for logging
                    throw new Error("Cost Group deletion failed: " + oErrorMessage.message);
                }
            });
        },

        mySuccessHandler: function (oSuccessMessage) {
            // Display success message with MessageToast
            MessageToast.show(oSuccessMessage.message, {
                duration: 3000,
                width: "20em",
                my: "center bottom",
                at: "center bottom",
                of: window,
                offset: "0 -50"
            });
            
            // Log success message container
            console.log("Success Message Container:", oSuccessMessage);
        },

        myErrorHandler: function (oErrorMessage) {
            var that = this;
            
            // Create error dialog
            if (!this._oErrorDialog) {
                this._oErrorDialog = new Dialog({
                    type: coreLibrary.MessageType.Error,
                    title: oErrorMessage.title,
                    state: "Error",
                    content: [
                        new Text({
                            text: oErrorMessage.message
                        }),
                        new Text({
                            text: "\n\nError Details:",
                            class: "sapUiMediumMarginTop"
                        }),
                        new Text({
                            text: "Error Code: " + (oErrorMessage.details.errorCode || "N/A")
                        }),
                        new Text({
                            text: "Error Text: " + (oErrorMessage.details.errorText || "N/A")
                        }),
                        new Text({
                            text: "Timestamp: " + oErrorMessage.timestamp
                        })
                    ],
                    beginButton: new Button({
                        type: "Emphasized",
                        text: "OK",
                        press: function () {
                            that._oErrorDialog.close();
                        }
                    }),
                    endButton: new Button({
                        text: "Show Technical Details",
                        press: function () {
                            that._showTechnicalDetails(oErrorMessage);
                        }
                    }),
                    afterClose: function () {
                        that._oErrorDialog.destroy();
                        that._oErrorDialog = null;
                    }
                });

                this.getView().addDependent(this._oErrorDialog);
            } else {
                // Update existing dialog content
                this._oErrorDialog.setTitle(oErrorMessage.title);
                this._oErrorDialog.removeAllContent();
                this._oErrorDialog.addContent(new Text({
                    text: oErrorMessage.message
                }));
                this._oErrorDialog.addContent(new Text({
                    text: "\n\nError Details:",
                    class: "sapUiMediumMarginTop"
                }));
                this._oErrorDialog.addContent(new Text({
                    text: "Error Code: " + (oErrorMessage.details.errorCode || "N/A")
                }));
                this._oErrorDialog.addContent(new Text({
                    text: "Error Text: " + (oErrorMessage.details.errorText || "N/A")
                }));
                this._oErrorDialog.addContent(new Text({
                    text: "Timestamp: " + oErrorMessage.timestamp
                }));
            }

            this._oErrorDialog.open();
            
            // Log error message container
            console.error("Error Message Container:", oErrorMessage);
        },

        _showTechnicalDetails: function (oErrorMessage) {
            if (!this._oTechnicalDialog) {
                this._oTechnicalDialog = new Dialog({
                    title: "Technical Error Details",
                    content: [
                        new Text({
                            text: JSON.stringify(oErrorMessage.technicalDetails, null, 2)
                        })
                    ],
                    beginButton: new Button({
                        text: "Close",
                        press: function () {
                            this._oTechnicalDialog.close();
                        }.bind(this)
                    }),
                    afterClose: function () {
                        this._oTechnicalDialog.destroy();
                        this._oTechnicalDialog = null;
                    }.bind(this)
                });

                this.getView().addDependent(this._oTechnicalDialog);
            }

            this._oTechnicalDialog.open();
        },

        _refreshTable: function () {
            var oTable = this.byId("costGroupsTable");
            if (oTable) {
                var oBinding = oTable.getBinding("items");
                if (oBinding) {
                    oBinding.refresh();
                }
            }
            // Update the count
            this._readDataCount();
        },

        _onObjectMatched: function (oEvent) {
            var costGroupId = oEvent.getParameter("arguments").costGroupId;
            // Use costGroupId to load data or update the view
        }
    });
});