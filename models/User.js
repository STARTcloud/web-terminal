import { DataTypes } from 'sequelize';
import { t } from '../config/i18n.js';

let User = null;

export const initializeUserModel = sequelize => {
  User = sequelize.define(
    'User',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmailOrDN(value) {
            // Allow email format or Distinguished Name format
            if (value.includes('@') || value.startsWith('CN=')) {
              return true;
            }
            throw new Error(t('validation.emailOrDnRequired'));
          },
        },
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      provider: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'OIDC provider identifier (e.g., oidc-google)',
      },
      subject: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'OIDC sub claim - unique per provider',
      },
      permissions: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
        comment: 'Array of permissions (kept for extensibility, currently not used)',
      },
      role: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'user',
        comment: 'User role: "user" or "admin"',
      },
      last_login: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'oidc_users',
      indexes: [
        {
          unique: true,
          fields: ['provider', 'subject'],
        },
        {
          fields: ['email'],
        },
      ],
    }
  );

  return User;
};

export const getUserModel = () => {
  if (!User) {
    throw new Error('User model not initialized. Call initializeUserModel() first.');
  }
  return User;
};

export default User;
