import {
  Model,
  ModelStatic,
  FindOptions,
  CreateOptions,
  UpdateOptions,
  DestroyOptions,
  Transaction,
  WhereOptions,
  Attributes,
  CreationAttributes,
} from 'sequelize';

export interface IBaseRepository<T extends Model> {
  findById(id: string, options?: FindOptions): Promise<T | null>;
  findOne(options: FindOptions): Promise<T | null>;
  findAll(options?: FindOptions): Promise<T[]>;
  findAndCountAll(options?: FindOptions): Promise<{ rows: T[]; count: number }>;
  create(data: CreationAttributes<T>, options?: CreateOptions): Promise<T>;
  update(
    data: Partial<Attributes<T>>,
    where: WhereOptions<T>,
    options?: Omit<UpdateOptions, 'where'>
  ): Promise<[number]>;
  updateById(
    id: string,
    data: Partial<Attributes<T>>,
    options?: Omit<UpdateOptions, 'where'>
  ): Promise<T | null>;
  delete(where: WhereOptions<T>, options?: DestroyOptions): Promise<number>;
  deleteById(id: string, options?: DestroyOptions): Promise<boolean>;
  count(options?: FindOptions): Promise<number>;
  exists(where: WhereOptions<T>): Promise<boolean>;
}

export abstract class BaseRepository<T extends Model> implements IBaseRepository<T> {
  protected model: ModelStatic<T>;

  constructor(model: ModelStatic<T>) {
    this.model = model;
  }

  async findById(id: string, options?: FindOptions): Promise<T | null> {
    return await this.model.findByPk(id, options);
  }

  async findOne(options: FindOptions): Promise<T | null> {
    return await this.model.findOne(options);
  }

  async findAll(options?: FindOptions): Promise<T[]> {
    return await this.model.findAll(options || {});
  }

  async findAndCountAll(options?: FindOptions): Promise<{ rows: T[]; count: number }> {
    return await this.model.findAndCountAll(options || {});
  }

  async create(data: CreationAttributes<T>, options?: CreateOptions): Promise<T> {
    return await this.model.create(data, options);
  }

  async update(
    data: Partial<Attributes<T>>,
    where: WhereOptions<T>,
    options?: Omit<UpdateOptions, 'where'>
  ): Promise<[number]> {
    return await this.model.update(data, { where, ...options });
  }

  async updateById(
    id: string,
    data: Partial<Attributes<T>>,
    options?: Omit<UpdateOptions, 'where'>
  ): Promise<T | null> {
    const [affectedCount] = await this.model.update(data, {
      where: { id } as any,
      ...options,
    });

    if (affectedCount > 0) {
      return await this.findById(id, options);
    }

    return null;
  }

  async delete(where: WhereOptions<T>, options?: DestroyOptions): Promise<number> {
    return await this.model.destroy({ where, ...options });
  }

  async deleteById(id: string, options?: DestroyOptions): Promise<boolean> {
    const deletedCount = await this.model.destroy({
      where: { id } as any,
      ...options,
    });
    return deletedCount > 0;
  }

  async count(options?: FindOptions): Promise<number> {
    return await this.model.count(options || {});
  }

  async exists(where: WhereOptions<T>): Promise<boolean> {
    const count = await this.model.count({ where });
    return count > 0;
  }
}
