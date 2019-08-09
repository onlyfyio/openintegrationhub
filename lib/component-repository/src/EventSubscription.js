const Component = require('./models/Component');

class EventSubscription {
    constructor({eventBus}) {
        this._eventBus = eventBus;
    }

    async subscribe() {
        this._subscribeToUserDeleted();
        await this._eventBus.connect();
    }

    async _subscribeToUserDeleted() {
        await this._eventBus.subscribe('iam.user.deleted', async (event) => {
            const { payload } = event;
            const { id } = payload;
            const owner = {id, type: 'user'};
            const components = await Component.findByOwner(owner);
            if (!components.length) {
                return;
            }

            for (const component of components) {
                component.removeOwner(owner);
                await component.save();
            }
        });
    }
}

module.exports = EventSubscription;