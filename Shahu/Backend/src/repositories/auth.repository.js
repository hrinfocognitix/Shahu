const userRepository = require('./user.repository');

module.exports = {
  findUserByEmailWithSecrets: email => userRepository.findByEmail(email, true),
  findUserByIdWithSecrets: id => userRepository.findByIdWithSecrets(id),
  createUser: payload => userRepository.create(payload)
};
