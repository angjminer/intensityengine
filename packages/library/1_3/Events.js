
// Copyright 2010 Alon Zakai ('kripken'). All rights reserved.
// This file is part of Syntensity/the Intensity Engine, an open source project. See COPYING.txt for licensing.

//! An action that can queue more actions on itself, which run on its actor.
//! Finishes when both this action itself is over, and when all subactions are done.
ContainerAction = Action.extend({
    _name: 'ContainerAction',

    create: function(otherActions, kwargs) {
        this._super(kwargs);

        this.otherActions = otherActions;
    },

    doStart: function() {
        this._super.apply(this, arguments);

        this.actionSystem = new ActionSystem(this.actor); // actor is now known

        forEach(this.otherActions, function(otherAction) {
            this.actionSystem.queue(otherAction);
        }, this);
    },

    doExecute: function(seconds) {
        this.actionSystem.manageActions(seconds);
        return this._super(seconds) && this.actionSystem.isEmpty();
    },

    doFinish: function(seconds) {
        if (!this.actionSystem.isEmpty() && this.actionSystem.actionList[0].begun) {
            this.actionSystem.actionList[0].finish();
        };

        this._super.apply(this, arguments);
    },

    abort: function() { // TODO: Move to actionSystem itself TODO: similar for ParallelAction
        this.actionSystem.clear();
        this.actionSystem.manageActions(0.01);
        if (!this.actionSystem.isEmpty() && this.actionSystem.actionList[0].begun) {
            this.actionSystem.actionList[0].finish();
        }
    },
});

//! Like ContainerAction, but runs actions in parallel. Finishes when all are done.
ParallelAction = Action.extend({
    _name: 'ParallelAction',

    canBeCancelled: false, // Simple assumption for now, TODO: Generalize

    create: function(otherActions, kwargs) {
        this._super(kwargs);

        this.actionSystems = [];
        this.otherActions = otherActions;
    },

    doStart: function() {
        this._super.apply(this, arguments);

        forEach(this.otherActions, this.addAction, this);
    },

    doExecute: function(seconds) {
        this.actionSystems = filter(function(actionSystem) {
            actionSystem.manageActions(seconds);
            return !actionSystem.isEmpty();
        }, this.actionSystems);
        return this._super(seconds) && this.actionSystems.length == 0;
    },

    doFinish: function(seconds) {
        forEach(this.actionSystems, function(actionSystem) {
            actionSystem.clear();
        });

        this._super.apply(this, arguments);
    },

    addAction: function(otherAction) {
        var actionSystem = new ActionSystem(this.actor);
        actionSystem.queue(otherAction);
        this.actionSystems.push(actionSystem);
    },
});

DelayedAction = Action.extend({
    _name: 'DelayedAction',

    //! @param command The command to be run
    create: function(command, kwargs) {
        this._super(kwargs);

        this.command = command;
    },

    //! Runs the command, and returns true, signalling that the action is finished
    doExecute: function(seconds) {
        if (this._super(seconds)) {
            this.command();
            return true;
        } else {
            return false;
        }
    },
});



RenderingCaptureActionPlugin = {
    doStart: function() {
        this._super.apply(this, arguments);

        if (this.renderDynamic) {
            this.renderDynamicOld = renderDynamic;
            renderDynamic = this.renderDynamic;
        }
        if (this.renderHUDModels) {
            this.renderHUDModelsOld = renderHUDModels;
            renderHUDModels = this.renderHUDModels;
        }
    },

    doFinish: function() {
        if (this.renderDynamic) {
            renderDynamic = this.renderDynamicOld;
        }
        if (this.renderHUDModels) {
            renderHUDModels = this.renderHUDModelsOld;
        }

        this._super.apply(this, arguments);
    },
};

InputCaptureActionPlugin = {
    doStart: function() {
        this._super.apply(this, arguments);

        if (this.clientClick) {
            this.oldClientClick = ApplicationManager.instance.clientClick;
            ApplicationManager.instance.clientClick = bind(this.clientClick, this);
        }
        if (this.actionKey) {
            this.oldActionKey = ApplicationManager.instance.actionKey;
            ApplicationManager.instance.actionKey = bind(this.actionKey, this)
        }
        if (this.performMovement) {
            this.oldPerformMovement = ApplicationManager.instance.performMovement;
            ApplicationManager.instance.performMovement = bind(this.performMovement, this)
        }
        if (this.performMousemove) {
            this.oldPerformMousemove = ApplicationManager.instance.performMousemove;
            ApplicationManager.instance.performMousemove = bind(this.performMousemove, this)
        }
        if (this.performJump) {
            this.oldPerformJump = ApplicationManager.instance.performJump;
            ApplicationManager.instance.performJump = bind(this.performJump, this)
        }
    },

    doFinish: function() {
        if (this.clientClick) {
            ApplicationManager.instance.clientClick = this.oldClientClick;
        }
        if (this.actionKey) {
            ApplicationManager.instance.actionKey = this.oldActionKey;
        }
        if (this.performMovement) {
            ApplicationManager.instance.performMovement = this.oldPerformMovement;
        }
        if (this.performMousemove) {
            ApplicationManager.instance.performMousemove = this.oldPerformMousemove;
        }
        if (this.performJump) {
            ApplicationManager.instance.performJump = this.oldPerformJump;
        }

        this._super.apply(this, arguments);
    },
};

InputCaptureAction = Action.extend(InputCaptureActionPlugin);


//! Plugin to make any class have an action system
ActionSystemPlugin = {
    create: function(owner) {
        this.actionSystem = new ActionSystem(owner ? owner : this);
    },

    tick: function(seconds) {
        this.actionSystem.manageActions(seconds);
    },

    setSleep: function() { },
};


//! Internal class
_ParallelActionSystemManager = Class.extend(ActionSystemPlugin).extend({
    create: function(owner) {
        this._super(owner);

        this.action = new ParallelAction([]);
        this.actionSystem.queue(this.action);
    },
});

//! Lets an entity run actions in parallel, separate from the main action system it has
ClientParallelActionsPlugin = {
    clientActivate: function() {
        this.parallelActionSystemManager = new _ParallelActionSystemManager(this);
    },

    clientAct: function(seconds) {
        this.parallelActionSystemManager.action.secondsLeft = seconds + 1.0; // Never end
        this.parallelActionSystemManager.tick(seconds);
    },

    addParallelAction: function(action) {
        this.parallelActionSystemManager.action.addAction(action);
    },
};

ClientParallelActionsPlugin.queueParallelAction = ClientParallelActionsPlugin.addParallelAction;

ParallelActionsPlugin = merge(ClientParallelActionsPlugin, {
    activate: ClientParallelActionsPlugin.clientActivate,
    act: ClientParallelActionsPlugin.clientAct,
});

