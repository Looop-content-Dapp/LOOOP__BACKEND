const matchUser = ({ id, name }) => {
  return {
    $match: {
      $expr: {
        $eq: [
          `$${name}`,
          {
            $toObjectId: id,
          },
        ],
      },
    },
  };
};

module.exports = { matchUser };
