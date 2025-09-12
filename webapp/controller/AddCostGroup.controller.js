sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/Dialog",
    "sap/m/Text",
    "sap/m/Button",
    "sap/ui/core/library"
], function (Controller, MessageToast, Dialog, Text, Button, coreLibrary) {
    "use strict";

    return Controller.extend("dccs.ui5.costgroups.controller.AddCostGroup", {
        
        onInit: function () {
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.getRoute("RouteCostGroupDetail").attachPatternMatched(this._onObjectMatched, this);
            oRouter.getRoute("RouteAddCostGroup").attachPatternMatched(this._onAddCostGroup, this);
        },

        onNavBack: function () {
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("RouteCostGroups");
        },

        _onObjectMatched: function (oEvent) {
            var costGroupId = oEvent.getParameter("arguments").costGroupId;
            var oModel = this.getOwnerComponent().getModel(); // default model
            var oViewModel = new sap.ui.model.json.JSONModel();
            var that = this;
            this.getView().setModel(oViewModel, "viewModel");

            // Set page title for edit mode
            oViewModel.setProperty("/pageTitle", this._getText("editCostGroupTitle"));

            // Read from your new Gateway service
            oModel.read("/ZSCOSTGRP_CASet(CostGrpId='" + costGroupId + "',Mandt='001')", {
                success: function (oData) {
                    // Map fields from your OData response
                    oViewModel.setProperty("/sortOrder", oData.SortOrder);
                    oViewModel.setProperty("/costGroupType", oData.CostGrpTypeNo);
                    oViewModel.setProperty("/costGroupTypeText", oData.CostGrpTypeText);
                    
                    // Set name and info text fields
                    oViewModel.setProperty("/nameGerman", oData.CostGrpName || "");
                    oViewModel.setProperty("/infoTextGerman", oData.CostGrpInfoTxt || "");
                    oViewModel.setProperty("/nameEnglish", oData.CostGrpName || "");
                    oViewModel.setProperty("/infoTextEnglish", oData.CostGrpInfoTxt || "");
                    
                    // Store the cost group ID for updates
                    oViewModel.setProperty("/costGroupId", oData.CostGrpId);
                    oViewModel.setProperty("/mandt", oData.Mandt);
                    oViewModel.setProperty("/langu", oData.Langu);
                    oViewModel.setProperty("/lastChanged", oData.LastChanged);
                },
                error: function (oError) {
                    // Handle error
                    sap.m.MessageToast.show("Error loading cost group data");
                    console.error("OData Read Error:", oError);
                }
            });
        },

        _onAddCostGroup: function (oEvent) {
            var oViewModel = new sap.ui.model.json.JSONModel();
            this.getView().setModel(oViewModel, "viewModel");

            // Set page title for add mode
            oViewModel.setProperty("/pageTitle", this._getText("addCostGroupTitle"));
            
            // Initialize empty form
            oViewModel.setProperty("/sortOrder", "");
            oViewModel.setProperty("/costGroupType", "");
            oViewModel.setProperty("/costGroupTypeText", "New Cost Group"); // Default title for add mode
            oViewModel.setProperty("/nameGerman", "");
            oViewModel.setProperty("/infoTextGerman", "");
            oViewModel.setProperty("/nameEnglish", "");
            oViewModel.setProperty("/infoTextEnglish", "");
            oViewModel.setProperty("/costGroupId", "");
            oViewModel.setProperty("/mandt", "001");
            oViewModel.setProperty("/langu", "EN");
        },

        onSave: function () {
            var oViewModel = this.getView().getModel("viewModel");
            var oModel = this.getOwnerComponent().getModel();
            var that = this;

            // Validate required fields
            var nameGerman = oViewModel.getProperty("/nameGerman");
            var infoTextGerman = oViewModel.getProperty("/infoTextGerman");
            var sortOrder = oViewModel.getProperty("/sortOrder");

            if (!nameGerman || !infoTextGerman || !sortOrder) {
                sap.m.MessageToast.show("Please fill all required fields");
                return;
            }

            // Prepare data for save
            var oData = {
                CostGrpId: oViewModel.getProperty("/costGroupId") || this._generateNewId(),
                Mandt: oViewModel.getProperty("/mandt"),
                SortOrder: parseInt(sortOrder),
                CostGrpTypeNo: oViewModel.getProperty("/costGroupType"),
                CostGrpName: nameGerman, // Using German as primary
                CostGrpInfoTxt: infoTextGerman, // Using German as primary
                Langu: oViewModel.getProperty("/langu") || "EN",
                CostGrpTypeText: oViewModel.getProperty("/costGroupTypeText")
            };

            var isEdit = !!oViewModel.getProperty("/costGroupId");

            if (isEdit) {
                // Update existing record
                var sPath = "/ZSCOSTGRP_CASet(CostGrpId='" + oData.CostGrpId + "',Mandt='" + oData.Mandt + "')";
                console.log("Update Path:", sPath);
                oModel.update(sPath, oData, {
                    success: function (oResponse) {
                        // Create success message container
                        var oSuccessMessage = {
                            type: "Success",
                            title: "Update Successful",
                            message: "Cost Group '" + oData.CostGrpName + "' has been successfully updated.",
                            timestamp: new Date().toISOString(),
                            details: {
                                costGroupId: oData.CostGrpId,
                                costGroupName: oData.CostGrpName,
                                operation: "UPDATE"
                            }
                        };
                        
                        // Call success handler
                        that.mySuccessHandler(oSuccessMessage);
                        that.onNavBack();
                    },
                    error: function (oError) {
                        // Create error message container
                        var oErrorMessage = {
                            type: "Error",
                            title: "Update Failed",
                            message: "Failed to update cost group '" + oData.CostGrpName + "'. Please try again.",
                            timestamp: new Date().toISOString(),
                            details: {
                                costGroupId: oData.CostGrpId,
                                costGroupName: oData.CostGrpName,
                                operation: "UPDATE",
                                errorCode: oError.statusCode || "UNKNOWN",
                                errorText: oError.statusText || "Unknown error occurred"
                            },
                            technicalDetails: oError
                        };
                        
                        // Call error handler
                        that.myErrorHandler(oErrorMessage);
                        
                        // Raise exception for logging
                        throw new Error("Cost Group update failed: " + oErrorMessage.message);
                    }
                });
            } else {
                // Create new record
                oModel.create("/ZSCOSTGRP_CASet", oData, {
                    success: function (oResponse) {
                        // Create success message container
                        var oSuccessMessage = {
                            type: "Success",
                            title: "Creation Successful",
                            message: "Cost Group '" + oData.CostGrpName + "' has been successfully created.",
                            timestamp: new Date().toISOString(),
                            details: {
                                costGroupId: oData.CostGrpId,
                                costGroupName: oData.CostGrpName,
                                operation: "CREATE"
                            }
                        };
                        
                        // Call success handler
                        that.mySuccessHandler(oSuccessMessage);
                        that.onNavBack();
                    },
                    error: function (oError) {
                        // Create error message container
                        var oErrorMessage = {
                            type: "Error",
                            title: "Creation Failed",
                            message: "Failed to create cost group '" + oData.CostGrpName + "'. Please try again.",
                            timestamp: new Date().toISOString(),
                            details: {
                                costGroupId: oData.CostGrpId,
                                costGroupName: oData.CostGrpName,
                                operation: "CREATE",
                                errorCode: oError.statusCode || "UNKNOWN",
                                errorText: oError.statusText || "Unknown error occurred"
                            },
                            technicalDetails: oError
                        };
                        
                        // Call error handler
                        that.myErrorHandler(oErrorMessage);
                        
                        // Raise exception for logging
                        throw new Error("Cost Group creation failed: " + oErrorMessage.message);
                    }
                });
            }
        },

        onCancel: function () {
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("RouteCostGroups");
        },

        _generateNewId: function () {
            // Generate a new ID - you might want to implement proper ID generation
            // based on your business logic
            return Date.now().toString().substr(-8).padStart(8, '0');
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

        _getText: function (sKey, aArgs) {
            var oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            return oBundle.getText(sKey, aArgs);
        }
    });
});