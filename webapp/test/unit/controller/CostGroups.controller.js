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

    // Define the Change Group ID for transactional deletion
    const DELETE_GROUP_ID = "deleteGroup";

    return Controller.extend("dccs.ui5.costgroups.controller.CostGroups", {
        onInit: function () {
            var oViewModel = new JSONModel({
                totalEntries: 0,
                busy: true,
                selectedCount: 0 // New property to track selected items for the Delete button
            });
            this.getView().setModel(oViewModel, "viewModel");
            var oModel = this.getOwnerComponent().getModel();
            if (oModel) {
                this.getView().setModel(oModel);
                
                // *** 1. Set up Deferred Group for Batch Deletion ***
                // All DELETE requests associated with this group will be bundled into one changeset
                // and processed atomically by the backend when submitChanges is called for this group.
                oModel.setDeferredGroups([DELETE_GROUP_ID]);

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
        
        // *** Group Deletion Feature ***
        
        onSelectionChange: function (oEvent) {
            // Update the selectedCount property in the viewModel to control the Delete button
            var oTable = this.byId("costGroupsTable");
            var iSelectedCount = oTable.getSelectedItems().length;
            this.getView().getModel("viewModel").setProperty("/selectedCount", iSelectedCount);
        },

        onGroupDeletePress: function () {
            var oTable = this.byId("costGroupsTable");
            var aSelectedItems = oTable.getSelectedItems();
            var iCount = aSelectedItems.length;
            var that = this;

            if (iCount === 0) {
                MessageToast.show(this._getText("noItemsSelected"));
                return;
            }

            MessageBox.confirm(
                this._getText("confirmGroupDeletion", [iCount]), 
                {
                    title: this._getText("confirmDeletionTitle"),
                    onClose: function (oAction) {
                        if (oAction === MessageBox.Action.OK) {
                            that._executeGroupDeletion(aSelectedItems);
                        }
                    }
                }
            );
        },

        _executeGroupDeletion: function (aSelectedItems) {
            var oModel = this.getView().getModel();
            var that = this;
            var iCount = aSelectedItems.length;

            // 1. Queue all DELETE operations into the deferred group
            aSelectedItems.forEach(function (oItem) {
                var oContext = oItem.getBindingContext();
                var sPath = oContext.getPath();
                
                // Important: Use the same ChangeSetId for all operations to ensure they are in one batch.
                // Note: The second argument is a parameter map, including the groupId.
                oModel.remove(sPath, {
                    groupId: DELETE_GROUP_ID,
                    changeSetId: DELETE_GROUP_ID // Ensures all removes are in one changeset
                });
            });

            // 2. Submit the entire changeset/batch request
            this.getView().getModel("viewModel").setProperty("/busy", true);

            oModel.submitChanges({
                groupId: DELETE_GROUP_ID,
                success: function (oData) {
                    that.getView().getModel("viewModel").setProperty("/busy", false);
                    that._handleGroupDeleteResponse(oData, iCount);
                    that._refreshTable();
                },
                error: function (oError) {
                    that.getView().getModel("viewModel").setProperty("/busy", false);
                    that._handleGroupDeleteError(oError);
                    that._refreshTable();
                }
            });
        },

        _handleGroupDeleteResponse: function (oData, iCount) {
            var aResponse = oData.__batchResponses;
            var oMsgContainer = sap.ui.getCore().getMessageManager();
            var bSuccess = true;
            var sBackendMessage = this._getText("errorGenericGroupDelete");

            // Look for the response from the CHANGESET_END (which contains the business logic result)
            if (aResponse && aResponse.length > 0) {
                var oChangeSet = aResponse.find(r => r.changesetid === DELETE_GROUP_ID);
                
                if (oChangeSet && oChangeSet.__abapMsg) {
                    // Check for the custom success message generated by ABAP CHANGESET_END
                    // The backend sends either: "5 entries deleted successfully" (Success) 
                    // or business exceptions (Failure)
                    sBackendMessage = oChangeSet.__abapMsg.text;
                    if (oChangeSet.__abapMsg.type === 'E') {
                        bSuccess = false;
                    } else if (oChangeSet.__abapMsg.type === 'S') {
                        // Success message from backend with the actual count
                        sBackendMessage = sBackendMessage || this._getText("successGroupDelete", [iCount]);
                    }
                } else if (oChangeSet && oChangeSet.response && oChangeSet.response.statusCode.startsWith("4")) {
                    // Handle non-ABAP specific errors (e.g., OData structural error)
                    bSuccess = false;
                    sBackendMessage = oChangeSet.response.statusText || this._getText("errorGenericGroupDelete");
                }
            }

            // Display the final status
            if (bSuccess) {
                // If the CHANGESET_END triggered a success message, use it.
                this.mySuccessHandler({ message: sBackendMessage || this._getText("successGroupDelete", [iCount]), title: this._getText("confirmDeletionTitle") });
            } else {
                // If any part of the changeset failed, the backend rollback and error message should be displayed.
                this.myErrorHandler({ message: sBackendMessage || this._getText("errorGenericGroupDelete"), title: this._getText("deletionFailedTitle"), details: {} });
            }

            // Clear selections after processing
            this.byId("costGroupsTable").removeSelections(true);
            this.getView().getModel("viewModel").setProperty("/selectedCount", 0);
        },

        _handleGroupDeleteError: function (oError) {
            var sErrorMessage = this._getText("errorNetworkGroupDelete");
            
            // Attempt to parse the technical error for more context
            if (oError && oError.response) {
                sErrorMessage = oError.response.statusText || sErrorMessage;
            }

            this.myErrorHandler({ message: sErrorMessage, title: this._getText("deletionFailedTitle"), details: { technicalDetails: oError } });
            
            // Clear selections
            this.byId("costGroupsTable").removeSelections(true);
            this.getView().getModel("viewModel").setProperty("/selectedCount", 0);
        },

        // *** Existing Functions (Unmodified) ***

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

        onFilterChange: function () {
            var aFilters = [];
            var sCostGroup = this.byId("costGroupInput").getValue();
            var sDescription = this.byId("descInput").getValue();

            if (sCostGroup) {
                aFilters.push(new Filter("CostGrpName", FilterOperator.Contains, sCostGroup));
            }
            if (sDescription) {
                aFilters.push(new Filter("CostGrpInfoTxt", FilterOperator.Contains, sDescription));
            }
            
            var oTable = this.byId("costGroupsTable");
            if (!oTable) { return; }
            var oBinding = oTable.getBinding("items");
            if (oBinding) {
                // Use AND condition for multiple filters
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

        // This is the old single delete function, which remains mostly unchanged
        onDeleteCostGroup: function (oEvent) {
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext();
            var oData = oContext.getObject();
            var that = this;

            MessageBox.confirm(
                this._getText("confirmSingleDeletion", [oData.CostGrpName]), 
                {
                    title: this._getText("confirmDeletionTitle"),
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
                // IMPORTANT: The single delete must NOT use the deferred DELETE_GROUP_ID,
                // so it commits immediately.
                success: function (oResponse) {
                    var oSuccessMessage = {
                        type: "Success",
                        title: that._getText("confirmDeletionTitle"),
                        message: that._getText("successSingleDelete", [oData.CostGrpName]),
                        timestamp: new Date().toISOString(),
                        details: {
                            costGroupId: oData.CostGrpId,
                            costGroupName: oData.CostGrpName,
                            operation: "DELETE"
                        }
                    };
                    
                    that.mySuccessHandler(oSuccessMessage);
                    that._refreshTable();
                },
                error: function (oError) {
                    var oErrorMessage = {
                        type: "Error",
                        title: that._getText("deletionFailedTitle"),
                        message: that._getText("errorSingleDelete", [oData.CostGrpName]),
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
                    
                    that.myErrorHandler(oErrorMessage);
                    
                    throw new Error("Cost Group deletion failed: " + oErrorMessage.message);
                }
            });
        },

        mySuccessHandler: function (oSuccessMessage) {
            MessageToast.show(oSuccessMessage.message, {
                duration: 3000,
                width: "20em",
                my: "center bottom",
                at: "center bottom",
                of: window,
                offset: "0 -50"
            });
            console.log("Success Message Container:", oSuccessMessage);
        },

        myErrorHandler: function (oErrorMessage) {
            var that = this;
            var sDetailText = oErrorMessage.details.errorText || "N/A";

            // If the error came from the batch response, details might be nested
            if (oErrorMessage.details.technicalDetails && oErrorMessage.details.technicalDetails.response) {
                var oResponse = oErrorMessage.details.technicalDetails.response;
                try {
                    var oJson = JSON.parse(oResponse.responseText);
                    sDetailText = oJson.error.message.value || sDetailText;
                } catch (e) {
                    // Ignore JSON parsing errors
                }
            }


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
                            text: "Error Text: " + sDetailText
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
                    text: "Error Text: " + sDetailText
                }));
                this._oErrorDialog.addContent(new Text({
                    text: "Timestamp: " + oErrorMessage.timestamp
                }));
            }

            this._oErrorDialog.open();
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
            this._readDataCount();
        },

        _onObjectMatched: function (oEvent) {
            var costGroupId = oEvent.getParameter("arguments").costGroupId;
            // Use costGroupId to load data or update the view
        }
    });
});