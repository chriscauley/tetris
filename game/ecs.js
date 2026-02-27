export class World {
  constructor() {
    this.entities = new Map();
    this.systems = [];
    this.nextId = 0;
  }

  createEntity() {
    const id = this.nextId++;
    this.entities.set(id, {});
    return id;
  }

  destroyEntity(id) {
    this.entities.delete(id);
  }

  addComponent(id, name, data) {
    const entity = this.entities.get(id);
    if (entity) entity[name] = data;
    return this;
  }

  getComponent(id, name) {
    const entity = this.entities.get(id);
    return entity ? entity[name] : undefined;
  }

  hasComponent(id, name) {
    const entity = this.entities.get(id);
    return entity ? name in entity : false;
  }

  removeComponent(id, name) {
    const entity = this.entities.get(id);
    if (entity) delete entity[name];
  }

  query(...names) {
    const results = [];
    for (const [id, components] of this.entities) {
      if (names.every(n => n in components)) {
        results.push(id);
      }
    }
    return results;
  }

  addSystem(system) {
    this.systems.push(system);
  }

  update() {
    for (const system of this.systems) {
      system.update(this);
    }
  }
}
