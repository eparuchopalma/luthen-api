import {
  Table,
  Model,
  Column,
  PrimaryKey,
  DataType,
  Default,
  HasMany
} from 'sequelize-typescript';
import Record from './recordModel';

@Table({ tableName: 'funds', timestamps: false })
class Fund extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id!: string;

  @Column({ allowNull: false })
  name!: string;

  @Default(0)
  @Column({ allowNull: false })
  balance!: number;

  @Column({ allowNull: false })
  user_id?: string;
  
  @Default(false)
  @Column({ allowNull: false })
  is_main!: boolean;

  @HasMany(() => Record)
  records!: Record[];
}

export default Fund;